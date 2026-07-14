import Image from "next/image";
import { instagramUrl, navigationItems } from "@/lib/site-content";

export function SiteFooter() {
  return (
    <footer className="bg-[var(--mat-surface-default)] px-6 py-12 lg:px-12 lg:py-16">
      <div className="mx-auto max-w-7xl border-t border-black/10 pt-10">
        <div className="flex flex-col justify-between gap-10 md:flex-row">
          <div>
            <div className="relative h-9 w-24">
              <Image
                alt="MAT Pilates"
                fill
                sizes="96px"
                src="/brand/mat-wordmark-dark.png"
                style={{ objectFit: "contain" }}
              />
            </div>
            <p className="mt-4 text-xs font-medium tracking-[0.1em] uppercase">
              Pilates MAT · Canning, Buenos Aires
            </p>
          </div>
          <nav aria-label="Enlaces del pie de página">
            <ul className="flex flex-wrap gap-x-5 gap-y-3 text-xs font-medium tracking-[0.1em] uppercase">
              {navigationItems.map((item) => (
                <li key={item.href}>
                  <a className="transition-opacity hover:opacity-60" href={item.href}>
                    {item.label}
                  </a>
                </li>
              ))}
              <li>
                <a
                  className="transition-opacity hover:opacity-60"
                  href={instagramUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Instagram
                </a>
              </li>
            </ul>
          </nav>
        </div>
        <p className="mt-12 text-[0.65rem] font-medium tracking-[0.08em] uppercase">
          © 2026 MAT Pilates. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}
