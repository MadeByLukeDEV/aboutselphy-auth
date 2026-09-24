import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { isTrustedOrigin, safeRedirect } from "@/lib/redirect";

// One-click sign-out for every consuming app: a plain HTML form POST
//   <form method="post" action="https://auth.aboutselphy.com/api/sign-out">
//     <input type="hidden" name="redirect" value="https://social.aboutselphy.com">
// ends the session (the cookie is on .aboutselphy.com, so this signs out of
// every admin surface at once) and 303s straight back to `redirect`.
export async function POST(request: Request) {
  // CSRF guard: browsers always send Origin on cross-origin form POSTs, so a
  // page outside our own origins can't sign staff out.
  if (!isTrustedOrigin(request.headers.get("origin"))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  const target = safeRedirect(form?.get("redirect")?.toString() || "/login");

  const result = await getAuth().api.signOut({ headers: request.headers, asResponse: true });
  const response = NextResponse.redirect(target, 303);
  // signOut's own response carries the Set-Cookie headers that clear the
  // session cookies (a no-op response if there was no session).
  for (const cookie of result.headers.getSetCookie()) response.headers.append("set-cookie", cookie);
  return response;
}
