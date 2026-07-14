import type { CSSProperties, ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  href: string;
  className?: string;
  variant?: "primary" | "light";
}

export function Button({
  children,
  href,
  className = "",
  variant = "primary",
}: ButtonProps) {
  const colorStyle: CSSProperties =
    variant === "primary"
      ? {
          backgroundColor: "var(--mat-action-primary)",
          color: "var(--mat-action-on-primary)",
        }
      : {
          backgroundColor: "var(--mat-surface-default)",
          color: "var(--mat-text-primary)",
        };

  return (
    <a
      className={`inline-flex min-h-11 items-center justify-center rounded-full px-5 py-3 text-xs font-semibold tracking-[0.08em] uppercase transition-opacity hover:opacity-80 ${className}`}
      href={href}
      style={colorStyle}
    >
      {children}
    </a>
  );
}
