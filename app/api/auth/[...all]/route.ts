import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { POST, GET } = toNextJsHandler(auth);

// Better Auth will handle all the API routes for authentication
// like /api/auth/sign-in, /api/auth/sign-up, /api/auth/sign-out, etc.