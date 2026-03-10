import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import arcjet, { BotOptions, detectBot, EmailOptions, protectSignup, shield, slidingWindow, SlidingWindowRateLimitOptions } from "@arcjet/next";
import { findIp } from "@arcjet/ip"

// Rules for the API routes
const aj = arcjet({
  key: process.env.ARCJET_API_KEY!,
  characteristics: ["userIdOrIp"],
  rules: [shield({ mode: "LIVE" })],      // Shield is a rule that blocks common attacks
});

// Block bots for the sign in page
const botSettings = { mode: 'LIVE', allow: [] } satisfies BotOptions

// Restricting requests [for Sign in and Sign Up]
const restrictiveRateLimitSettings = {
  mode: 'LIVE',
  max: 10,
  interval: '10m',
} satisfies SlidingWindowRateLimitOptions<[]>;

// Relaxed requests [for other routes]
const laxRateLimitSettings = {
  mode: 'LIVE',
  max: 2,
  interval: '1m',
} satisfies SlidingWindowRateLimitOptions<[]>;

// Ensures real emails are used
const emailSettings = {
  mode: 'LIVE',
  deny: ["DISPOSABLE", "INVALID", "NO_MX_RECORDS"]
} satisfies EmailOptions;

// Performs Arcjet checks
async function checkArcjet(request: Request) {


  const body = (await request.json() as unknown);                             // Gets the body information
  const session = await auth.api.getSession({ headers: request.headers });    // User Logged in or not

  const userIdOrIp = (session?.user.id ?? findIp(request)) || "127.0.0.1"

  // Restrict based on urls
  if (request.url.endsWith("/auth/sign-up")) {
    if (body && typeof body === "object" && "email" in body && typeof body.email === "string") {
      aj.withRule(
        protectSignup({
          email: emailSettings,
          bots: botSettings,
          rateLimit: restrictiveRateLimitSettings
        })
      ).protect(request, { email: body.email, userIdOrIp });
    } else {
      return aj
        .withRule(detectBot(botSettings))
        .withRule(slidingWindow(restrictiveRateLimitSettings))
        .protect(request, { userIdOrIp });
    }
  }
  return aj
    .withRule(detectBot(botSettings))
    .withRule(slidingWindow(laxRateLimitSettings))
    .protect(request, { userIdOrIp });
}

const authHandlers = toNextJsHandler(auth);
export const { GET } = authHandlers;

export async function POST(request: Request) {
  const cloned = request.clone();                                             // Clones the request [Better Auth and custom]
  const decision = await checkArcjet(request);                                // Checks for Arcjet decisions

  if (decision?.isDenied()) {
    if (decision.reason.isRateLimit()) {
      return new Response(null, { status: 429 })

    } else if (decision.reason.isEmail()) {                                  // Check for accepted email types
      let message: String

      // Decision cases
      if (decision.reason.emailTypes.includes("INVALID")) {
        message = "Email address format in invalid. Check the spelling and format";
      } else if (decision.reason.emailTypes.includes("DISPOSABLE")) {
        message = "Disposable emails are not allowed";
      } else if (decision.reason.emailTypes.includes("NO_MX_RECORDS")) {
        message = "Email domain is not allowed";
      } else {
        message = "Invalid email address";
      }

      return Response.json({ message }, { status: 400 });
    } else {
      return new Response(null, { status: 403 });

    }
  }

  return authHandlers.POST(cloned);
}

// Better Auth will handle all the API routes for authentication
// like /api/auth/sign-in, /api/auth/sign-up, /api/auth/sign-out, etc