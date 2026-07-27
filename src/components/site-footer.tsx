import Image from "next/image";
import { footerNavigationItems, siteContact } from "@/lib/site-content";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__links">
        <a aria-label="MAT Pilates, inicio" className="site-footer__brand" href="#inicio">
          <Image
            alt="MAT Pilates"
            fill
            sizes="173px"
            src="/brand/mat-wordmark-light-menu-desktop.svg"
          />
        </a>
        <span aria-hidden="true" className="site-footer__spacer" />
        <nav aria-label="Enlaces del pie de página">
          <ul className="site-footer__navigation">
            {footerNavigationItems.map((item) => (
              <li key={item.href}>
                <a href={item.href}>{item.label}</a>
              </li>
            ))}
            <li>
              <a href={siteContact.instagram.url} rel="noreferrer" target="_blank">
                Instagram
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <div className="site-footer__legal">
        <p>{siteContact.location.label}</p>
        <p>© 2026 MAT Pilates. Todos los derechos reservados.</p>
      </div>
    </footer>
  );
}
