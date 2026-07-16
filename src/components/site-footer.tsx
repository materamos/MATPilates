import Image from "next/image";
import { instagramUrl, navigationItems } from "@/lib/site-content";

export function SiteFooter() {
  return (
    <footer className="h-[261px] bg-[var(--mat-surface-default)] px-6 lg:h-[400px] lg:px-0">
      <div className="relative mx-auto h-full max-w-[1232px]">
        <div className="absolute left-0 right-0 top-12 h-px bg-[var(--mat-color-border-default)]/15 lg:top-14" />
        <div className="absolute left-0 top-[65px] h-9 w-[100px] lg:top-[98px] lg:h-[68px] lg:w-[154px]">
          <Image alt="MAT Pilates" fill sizes="(min-width: 1024px) 154px, 100px" src="/brand/mat-wordmark-dark.svg" style={{ objectFit: "cover" }} />
        </div>
        <p className="absolute left-0 top-[117px] text-xs font-medium leading-4 tracking-[0.0667em] uppercase lg:top-[168px]">
          Pilates MAT · Canning, Buenos Aires
        </p>
        <nav aria-label="Enlaces del pie de página" className="absolute left-0 top-[149px] lg:left-[602px] lg:top-[118px]">
          <ul className="flex flex-wrap gap-x-5 text-xs font-medium leading-4 tracking-[0.0667em] uppercase">
            {navigationItems.map((item) => (
              <li key={item.href}>
                <a className="transition-opacity hover:opacity-60" href={item.href}>
                  {item.label}
                </a>
              </li>
            ))}
            <li>
              <a className="transition-opacity hover:opacity-60" href={instagramUrl} rel="noreferrer" target="_blank">Instagram</a>
            </li>
          </ul>
        </nav>
        <p className="absolute left-0 top-[181px] max-w-[342px] text-[0.65rem] font-medium leading-4 tracking-[0.0667em] uppercase lg:top-[318px] lg:max-w-none">
          © 2026 MAT Pilates. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}
