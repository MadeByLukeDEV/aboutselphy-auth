import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// auth.aboutselphy.com itself: your account if signed in, otherwise sign-in.
export default async function HomePage() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  redirect(session ? "/account" : "/login?audience=viewer");
}
