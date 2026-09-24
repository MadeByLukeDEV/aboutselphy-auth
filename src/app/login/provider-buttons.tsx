"use client";

import { useFormStatus } from "react-dom";
import type { BrandIcon } from "@/lib/brand-icons";

export type ProviderOption = {
  id: string;
  label: string;
  icon: BrandIcon;
  comingSoon: boolean;
};

// One submit button per provider inside a single <form>: useFormStatus tells
// us which one was clicked, so only that button shows the pending state while
// every button is disabled (no double submits during the OAuth redirect).
export function ProviderButtons({ providers }: { providers: ProviderOption[] }) {
  const { pending, data } = useFormStatus();
  const active = pending ? data?.get("provider") : null;

  return (
    <div className="providers">
      {providers.map((provider) => {
        const isActive = active === provider.id;
        return (
          <button
            key={provider.id}
            type="submit"
            name="provider"
            value={provider.id}
            className="provider"
            style={{ "--brand": provider.icon.hex } as React.CSSProperties}
            disabled={pending || provider.comingSoon}
            aria-busy={isActive}
          >
            {isActive ? (
              <span className="spinner" aria-hidden />
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden className="provider-icon">
                <path d={provider.icon.path} />
              </svg>
            )}
            <span className="provider-label">
              {isActive ? `Redirecting to ${provider.label}…` : `Continue with ${provider.label}`}
            </span>
            {provider.comingSoon && <span className="badge">Soon</span>}
          </button>
        );
      })}
    </div>
  );
}
