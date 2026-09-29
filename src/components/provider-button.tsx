"use client";

import { useFormStatus } from "react-dom";
import type { BrandIcon } from "@/lib/brand-icons";

type Props = {
  /** Posted as `choice` -- see src/app/actions.ts. */
  choice: string;
  label: string;
  pendingLabel: string;
  icon?: BrandIcon;
  badge?: string;
  disabled?: boolean;
  variant?: "provider" | "compact";
};

// Every button in a <form> shares one pending state; useFormStatus().data says
// which one was clicked, so only it shows the spinner while all are disabled
// (no double submits during the OAuth redirect).
export function ProviderButton({ choice, label, pendingLabel, icon, badge, disabled, variant = "provider" }: Props) {
  const { pending, data } = useFormStatus();
  const active = pending && data?.get("choice") === choice;

  return (
    <button
      type="submit"
      name="choice"
      value={choice}
      className={variant}
      style={icon ? ({ "--brand": icon.hex } as React.CSSProperties) : undefined}
      disabled={pending || disabled}
      aria-busy={active}
    >
      {active ? (
        <span className="spinner" aria-hidden />
      ) : (
        icon && (
          <svg viewBox="0 0 24 24" aria-hidden className="provider-icon">
            <path d={icon.path} />
          </svg>
        )
      )}
      <span className="provider-label">{active ? pendingLabel : label}</span>
      {badge && <span className="badge">{badge}</span>}
    </button>
  );
}
