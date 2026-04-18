export const runtime = "nodejs";

import { signIn } from "@/auth";

export async function GET() {
  if (process.env.NODE_ENV !== "development" || !process.env.NEXT_PUBLIC_DEV_AUTO_LOGIN) {
    return new Response("Not available", { status: 404 });
  }
  await signIn("dev", { redirectTo: "/dashboard" });
}
