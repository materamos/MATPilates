"use client";

import Image from "next/image";
import { type MouseEvent, useEffect, useRef, useState } from "react";
import { landingCtas, navigationItems, siteContact } from "@/lib/site-content";
import { Button } from "./button";

export function SiteHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuDestinationRef = useRef<{ element: HTMLElement; href: string } | null>(null);

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
    return () => {
      document.body.style.overflow = previousOverflow;
      backgroundElements.forEach((element) => {
        element.inert = false;
      });
      document.removeEventListener("keydown", closeOnEscape);
      if (!menuDestinationRef.current) {
        menuButton?.focus();
      }
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (isMenuOpen || !menuDestinationRef.current) {
      return;
    }

    const destination = menuDestinationRef.current;
    menuDestinationRef.current = null;
    window.location.hash = destination.href;
    window.requestAnimationFrame(() => {
      destination.element.focus({ preventScroll: true });
    });
  }, [isMenuOpen]);

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 1024px)");
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
  const navigateFromMenu = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    const destination = document.querySelector<HTMLElement>(`${href} h2`);

    if (!destination) {
      closeMenu();
      return;
    }

    event.preventDefault();
    menuDestinationRef.current = { element: destination, href };
    closeMenu();
  };

  return (
    <header className="site-header">
      <div className={`site-header__bar${isMenuOpen ? " site-header__bar--menu-open" : ""}`}>
        <a
          aria-label="MAT Pilates, inicio"
          className="site-header__logo"
          href="#inicio"
          onClick={closeMenu}
        >
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
                    {item.desktopLabel}
                  </a>
                </li>
              ))}
            </ul>
            <span aria-hidden="true" className="site-header__desktop-spacer" />
            <Button
              className="site-header__desktop-cta"
              href={landingCtas.join.href}
              variant="light"
            >
              {landingCtas.learnHowToJoin.label}
            </Button>
          </div>
        </nav>
        <button
          aria-controls="mobile-navigation"
          aria-expanded={isMenuOpen}
          aria-label={isMenuOpen ? "Cerrar menú" : "Abrir menú"}
          className={`site-header__menu-toggle${isMenuOpen ? " site-header__menu-toggle--open" : ""}`}
          onClick={() => setIsMenuOpen((currentValue) => !currentValue)}
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
          <nav aria-label="Navegación móvil" className="site-menu__links">
            <ul>
              {navigationItems.map((item) => (
                <li key={item.href}>
                  <a
                    className="site-menu__link"
                    href={item.href}
                    onClick={(event) => navigateFromMenu(event, item.href)}
                  >
                    <span>{item.label}</span>
                    <span aria-hidden="true" className="site-menu__arrow" />
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div aria-hidden="true" className="site-menu__spacer" />
          <Button
            className="site-menu__cta"
            href={landingCtas.join.href}
            onClick={(event) => navigateFromMenu(event, landingCtas.join.href)}
            variant="light"
          >
            {landingCtas.learnHowToJoin.label}
          </Button>
          <a
            className="site-menu__location"
            href={siteContact.location.mapsUrl}
            onClick={closeMenu}
            rel="noreferrer"
            target="_blank"
          >
            <p className="site-menu__venue">{siteContact.location.venue}</p>
            <p className="site-menu__address">{siteContact.location.address.replace(",", " ·")}</p>
          </a>
        </div>
      ) : null}
    </header>
  );
}
