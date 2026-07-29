import type { CSSProperties, ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  href: string;
  ariaLabel?: string;
  className?: string;
  onClick?: () => void;
  rel?: string;
  target?: "_blank" | "_parent" | "_self" | "_top";
  variant?: "primary" | "light";
}

export function Button({
  children,
  href,
  ariaLabel,
  className = "",
  onClick,
  rel,
  target,
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
      aria-label={ariaLabel}
      className={`inline-flex min-h-[52px] items-center justify-center rounded-full px-6 py-4 text-sm font-normal leading-5 tracking-[0.2px] uppercase transition-opacity hover:opacity-80 ${className}`}
      href={href}
      onClick={onClick}
      rel={rel}
      style={colorStyle}
      target={target}
    >
      {children}
    </a>
  );
}
