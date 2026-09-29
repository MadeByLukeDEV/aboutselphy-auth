import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Static security headers for every response (same set as the Main app).
// The per-request CSP (nonce) is set in src/proxy.ts.
const securityHeaders = [
  // HTTPS only, for 2 years, including every *.aboutselphy.com subdomain.
  // Production only: HSTS on localhost would pin http://localhost too.
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Sign-in URLs carry ?redirect=...; never send the full URL to other sites.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Legacy twin of CSP frame-ancestors 'none': the login page can't be framed.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  // Thin service on a resource-constrained VPS: the standalone output ships
  // only the traced dependencies instead of the full node_modules.
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
