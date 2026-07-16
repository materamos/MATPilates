import type { CSSProperties, ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  href: string;
  className?: string;
  onClick?: () => void;
  variant?: "primary" | "light";
}

export function Button({
  children,
  href,
  className = "",
  onClick,
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
      className={`inline-flex min-h-[52px] items-center justify-center rounded-full px-6 py-4 text-sm font-semibold leading-5 tracking-[0.0143em] uppercase transition-opacity hover:opacity-80 ${className}`}
      href={href}
      onClick={onClick}
      style={colorStyle}
    >
      {children}
    </a>
  );
}
