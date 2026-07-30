import type { MouseEventHandler, ReactNode } from "react";
import { OriginButton } from "@/components/ui/origin-button";

interface ButtonProps {
  children: ReactNode;
  href: string;
  ariaLabel?: string;
  className?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  rel?: string;
  target?: "_blank" | "_parent" | "_self" | "_top";
  variant?: "primary" | "light" | "text";
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
  const variantClassName = `mat-button--${variant}`;

  return (
    <OriginButton
      aria-label={ariaLabel}
      className={`mat-button ${variantClassName} inline-flex min-h-[52px] items-center justify-center rounded-full px-6 py-4 text-sm font-normal leading-5 tracking-[0.2px] uppercase ${className}`}
      href={href}
      onClick={onClick}
      rel={rel}
      target={target}
    >
      {children}
    </OriginButton>
  );
}
