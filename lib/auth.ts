import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@/app/drizzle/db";
import { nextCookies } from "better-auth/next-js";

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
  },

  // Social based sign ins TODO

  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60, // 1 minute 
    }
  },

  plugins: [nextCookies()],     // For the nextjs application to work with cookies

  database: drizzleAdapter(db, {
    provider: "pg",
  }),
});