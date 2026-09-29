import type { Audience } from "@/lib/providers";

/** Hidden inputs that carry ?redirect= and ?audience= through a server action. */
export function FlowFields({ redirectTo, audience }: { redirectTo?: string; audience: Audience }) {
  return (
    <>
      {redirectTo && <input type="hidden" name="redirect" value={redirectTo} />}
      <input type="hidden" name="audience" value={audience} />
    </>
  );
}
