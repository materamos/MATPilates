import Image from "next/image";
import { navigationItems } from "@/lib/site-content";
import { Button } from "./button";

export function SiteHeader() {
  return (
    <header className="border-b border-black/5 bg-[var(--mat-surface-default)]">
      <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-6 px-6 lg:px-12">
        <a aria-label="MAT Pilates, inicio" className="relative h-9 w-24" href="#inicio">
          <Image
            alt="MAT Pilates"
            fill
            priority
            sizes="96px"
            src="/brand/mat-wordmark-dark.png"
            style={{ objectFit: "contain" }}
          />
        </a>
        <nav aria-label="Navegación principal" className="hidden md:block">
          <ul className="flex items-center gap-7 text-xs font-medium tracking-[0.1em] uppercase">
            {navigationItems.map((item) => (
              <li key={item.href}>
                <a className="transition-opacity hover:opacity-60" href={item.href}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <Button href="#contacto">Reservar</Button>
      </div>
    </header>
  );
}
