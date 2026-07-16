"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { navigationItems } from "@/lib/site-content";
import { Button } from "./button";

export function SiteHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isMenuOpen]);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className="sticky top-0 z-30 bg-[var(--mat-surface-default)]">
      <div className="mx-auto flex h-20 max-w-[1232px] items-center justify-between px-6 lg:h-28 lg:px-0">
        <a aria-label="MAT Pilates, inicio" className="relative h-9 w-[100px] lg:h-[60px] lg:w-[164px]" href="#inicio">
          <Image
            alt="MAT Pilates"
            fill
            priority
            sizes="(min-width: 1024px) 164px, 100px"
            src="/brand/mat-wordmark-dark.svg"
            style={{ objectFit: "cover" }}
          />
        </a>
        <nav aria-label="Navegación principal" className="hidden lg:block">
          <ul className="flex items-center gap-9 text-xs font-medium tracking-[0.0667em] uppercase">
            {navigationItems.map((item) => (
              <li key={item.href}>
                <a className="transition-opacity hover:opacity-60" href={item.href}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <Button className="!hidden lg:!inline-flex lg:!min-h-11 lg:!py-3" href="#contacto">
          Reservar
        </Button>
        <button
          aria-controls="mobile-navigation"
          aria-expanded={isMenuOpen}
          aria-label={isMenuOpen ? "Cerrar menú" : "Abrir menú"}
          className="relative grid size-11 place-items-center lg:hidden"
          onClick={() => setIsMenuOpen((open) => !open)}
          type="button"
        >
          <span className="sr-only">Menú</span>
          <span
            aria-hidden="true"
            className={`absolute h-px w-6 bg-current transition-transform duration-300 ${
              isMenuOpen ? "rotate-45" : "-translate-y-1"
            }`}
          />
          <span
            aria-hidden="true"
            className={`absolute h-px w-6 bg-current transition-opacity duration-200 ${
              isMenuOpen ? "opacity-0" : "opacity-100"
            }`}
          />
          <span
            aria-hidden="true"
            className={`absolute h-px w-6 bg-current transition-transform duration-300 ${
              isMenuOpen ? "-rotate-45" : "translate-y-1"
            }`}
          />
        </button>
      </div>
      <div
        aria-hidden={!isMenuOpen}
        className={`fixed inset-0 z-40 bg-[var(--mat-surface-inverse)] text-[var(--mat-text-inverse)] transition-opacity duration-300 lg:hidden ${
          isMenuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        id="mobile-navigation"
      >
        <div className="flex h-20 items-center justify-between px-6">
          <div className="relative h-9 w-[100px]">
            <Image alt="MAT Pilates" fill sizes="100px" src="/brand/mat-wordmark-light.svg" style={{ objectFit: "cover" }} />
          </div>
          <button aria-label="Cerrar menú" className="relative grid size-11 place-items-center" onClick={closeMenu} type="button">
            <span aria-hidden="true" className="absolute h-px w-6 rotate-45 bg-current" />
            <span aria-hidden="true" className="absolute h-px w-6 -rotate-45 bg-current" />
          </button>
        </div>
        <div className="flex h-[calc(100%-5rem)] flex-col px-6 pt-[3.625rem] pb-9">
          <p className="text-xs font-medium tracking-[0.0667em] uppercase">Navegación</p>
          <nav aria-label="Navegación móvil" className="mt-2">
            <ul>
              {navigationItems.map((item, index) => (
                <li key={item.href} className={index === 0 ? "" : "border-t border-[var(--mat-text-inverse)]/25"}>
                  <a
                    className="flex h-[69px] items-center text-[2rem] font-semibold leading-10 tracking-[-0.025em]"
                    href={item.href}
                    onClick={closeMenu}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <Button className="mt-[145px] min-h-[52px] w-full" href="#contacto" onClick={closeMenu} variant="light">
            Reservar
          </Button>
          <p className="mt-8 text-xs font-medium tracking-[0.0667em] uppercase">Pilates MAT · Canning, Buenos Aires</p>
        </div>
      </div>
    </header>
  );
}
