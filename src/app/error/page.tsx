import Link from "next/link";
import { errorMessage } from "@/lib/errors";

// Fallback for errors outside a sign-in attempt (BetterAuth's onAPIError);
// sign-in failures show inline on /login instead.
export default async function ErrorPage({ searchParams }: PageProps<"/error">) {
  const { error } = await searchParams;

  return (
    <>
      <header className="stack">
        <span className="eyebrow">aboutselphy staff</span>
        <h1>Couldn&apos;t sign you in</h1>
      </header>
      <p className="alert" role="alert">
        {errorMessage(error) ?? "Something went wrong while signing in."}
      </p>
      <Link className="button secondary" href="/login">
        Back to sign-in
      </Link>
    </>
  );
}
