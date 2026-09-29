import type { Metadata } from "next";
import { connection } from "next/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "aboutselphy — Sign in",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Render every page per request: Next only puts the CSP nonce
  // (src/proxy.ts) on the scripts of a dynamically rendered page; a static
  // page's scripts would be blocked.
  await connection();
  return (
    <html lang="en">
      <body>
        <main className="card">{children}</main>
      </body>
    </html>
  );
}
