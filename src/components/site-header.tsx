"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { navigationItems, siteContact } from "@/lib/site-content";
import { Button } from "./button";

export function SiteHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const backgroundElements = Array.from(
      document.querySelectorAll<HTMLElement>("main, footer, body > a"),
    );
    const menuButton = menuButtonRef.current;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    backgroundElements.forEach((element) => {
      element.inert = true;
    });
    document.addEventListener("keydown", closeOnEscape);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      backgroundElements.forEach((element) => {
        element.inert = false;
      });
      document.removeEventListener("keydown", closeOnEscape);
      menuButton?.focus();
    };
  }, [isMenuOpen]);

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 1440px)");
    const closeAtDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setIsMenuOpen(false);
      }
    };

    desktopQuery.addEventListener("change", closeAtDesktop);

    return () => {
      desktopQuery.removeEventListener("change", closeAtDesktop);
    };
  }, []);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className="site-header">
      <div className="site-header__bar" inert={isMenuOpen}>
        <a aria-label="MAT Pilates, inicio" className="site-header__logo" href="#inicio">
          <Image
            alt="MAT Pilates"
            className="site-header__logo-mobile"
            fill
            priority
            sizes="115px"
            src="/brand/mat-wordmark-light-menu-mobile.svg"
          />
          <Image
            alt="MAT Pilates"
            className="site-header__logo-desktop"
            fill
            priority
            sizes="173px"
            src="/brand/mat-wordmark-light-menu-desktop.svg"
          />
        </a>
        <nav aria-label="Navegación principal" className="site-header__desktop-nav">
          <div className="site-header__desktop-group">
            <ul className="site-header__desktop-links">
              {navigationItems.map((item) => (
                <li key={item.href}>
                  <a
                    className="site-header__desktop-link transition-opacity hover:opacity-60"
                    href={item.href}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
            <span aria-hidden="true" className="site-header__desktop-spacer" />
            <Button className="site-header__desktop-cta" href="#contacto" variant="light">
              Reservá tu clase
            </Button>
          </div>
        </nav>
        <button
          aria-controls="mobile-navigation"
          aria-expanded={isMenuOpen}
          aria-label="Abrir menú"
          className="site-header__menu-toggle"
          onClick={() => setIsMenuOpen(true)}
          ref={menuButtonRef}
          type="button"
        >
          <span className="sr-only">Menú</span>
          <span aria-hidden="true" className="site-header__menu-toggle-lines">
            <span className="site-header__menu-toggle-line" />
            <span className="site-header__menu-toggle-line" />
          </span>
        </button>
      </div>
      {isMenuOpen ? (
        <div className="site-menu" id="mobile-navigation">
          <div className="site-menu__header">
            <div className="site-header__logo">
              <Image
                alt="MAT Pilates"
                fill
                sizes="115px"
                src="/brand/mat-wordmark-light-menu-mobile.svg"
              />
            </div>
            <button
              aria-label="Cerrar menú"
              className="site-menu__close"
              onClick={closeMenu}
              ref={closeButtonRef}
              type="button"
            >
              <Image
                alt=""
                aria-hidden="true"
                className="site-menu__close-icon"
                height={24}
                src="/icons/menu-close.svg"
                width={24}
              />
            </button>
          </div>
          <nav aria-label="Navegación móvil" className="site-menu__links">
            <ul>
              {navigationItems.map((item) => (
                <li key={item.href}>
                  <a className="site-menu__link" href={item.href} onClick={closeMenu}>
                    <span>{item.label}</span>
                    <span aria-hidden="true" className="site-menu__arrow">
                      →
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div aria-hidden="true" className="site-menu__spacer" />
          <Button className="site-menu__cta" href="#contacto" onClick={closeMenu} variant="light">
            Reservá tu clase
          </Button>
          <div className="site-menu__location">
            <p className="site-menu__venue">{siteContact.location.venue}</p>
            <p className="site-menu__address">{siteContact.location.address.replace(",", " ·")}</p>
          </div>
        </div>
      ) : null}
    </header>
  );
}
