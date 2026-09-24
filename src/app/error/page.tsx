import Link from "next/link";
import { NOT_IN_GUILD, NOT_STAFF, ROLE_CHECK_FAILED } from "@/lib/discord-roles";

const MESSAGES: Record<string, string> = {
  [NOT_STAFF]: "Your Discord account doesn't have a moderator or admin role on the aboutselphy server.",
  [NOT_IN_GUILD]: "Your Discord account isn't a member of the aboutselphy server.",
  [ROLE_CHECK_FAILED]: "We couldn't verify your Discord roles. Please try again in a moment.",
  access_denied: "Discord sign-in was cancelled.",
};

export default async function ErrorPage({ searchParams }: PageProps<"/error">) {
  const { error } = await searchParams;
  const message = (typeof error === "string" && MESSAGES[error]) || "Something went wrong while signing in.";

  return (
    <>
      <h1>Access denied</h1>
      <p className="error">{message}</p>
      <Link className="button secondary" href="/login">
        Back to sign-in
      </Link>
    </>
  );
}
