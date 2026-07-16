import Image from "next/image";
import { instagramUrl, navigationItems } from "@/lib/site-content";

export function SiteFooter() {
  return (
    <footer className="site-footer h-[261px] bg-[var(--mat-surface-default)] px-6 xl:h-[400px] xl:px-0">
      <div className="site-footer__content relative mx-auto h-full max-w-[1232px]">
        <div className="site-footer__divider absolute left-0 right-0 top-12 h-px bg-[var(--mat-color-border-default)]/15 xl:top-14" />
        <div className="site-footer__brand absolute left-0 top-[65px] h-9 w-[100px] xl:top-[98px] xl:h-[68px] xl:w-[154px]">
          <Image alt="MAT Pilates" fill sizes="(min-width: 1024px) 154px, 100px" src="/brand/mat-wordmark-dark.svg" style={{ objectFit: "cover" }} />
        </div>
        <p className="site-footer__location absolute left-0 top-[117px] text-xs font-medium leading-4 tracking-[0.0667em] uppercase xl:top-[168px]">
          Pilates MAT · Canning, Buenos Aires
        </p>
        <nav aria-label="Enlaces del pie de página" className="site-footer__navigation absolute left-0 top-[149px] xl:left-[602px] xl:top-[118px]">
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
        <p className="site-footer__copyright absolute left-0 top-[181px] max-w-[342px] text-[0.65rem] font-medium leading-4 tracking-[0.0667em] uppercase xl:top-[318px] xl:max-w-none">
          © 2026 MAT Pilates. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}
