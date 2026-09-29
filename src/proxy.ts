import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, createNonce } from "@/lib/csp";

const CSP_HEADER = "Content-Security-Policy";

// A fresh nonce + CSP per request. Next reads the nonce from the *request*
// CSP header while rendering and applies it to its own scripts; the response
// carries the same policy. Static headers (HSTS, nosniff, ...) are in
// next.config.ts.
export function proxy(request: NextRequest) {
  const nonce = createNonce();
  const csp = buildCsp(nonce);

  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set(CSP_HEADER, csp);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set(CSP_HEADER, csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: not API routes (JSON/redirects), Next internals or files
      // with an extension. No backslashes in here: a production build turned
      // `\\.` into "." in the Main app and the CSP silently vanished. Use a
      // character class and re-check the header on a production build.
      source: "/((?!api|_next|.*[.].*).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
