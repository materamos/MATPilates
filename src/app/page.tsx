import Image from "next/image";
import { Button } from "@/components/button";
import { ClassCard } from "@/components/class-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { StudioGallery } from "@/components/studio-gallery";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { classCatalog, landingContent, siteContact } from "@/lib/site-content";

export default function HomePage() {
  const { hero, manifesto, hotMat, classes, studio, reservation } = landingContent;

  return (
    <>
      <SiteHeader />
      <main>
        <section className="mat-hero mat-scroll-target" id="inicio">
          <div className="mat-hero__copy">
            <p className="mat-label">{hero.eyebrow}</p>
            <h1 className="mat-hero__title">{hero.title}</h1>
            <p className="mat-body mat-hero__description">{hero.description}</p>
            <span aria-hidden="true" className="mat-hero__spacer" />
            <div className="mat-hero__actions">
              <Button className="mat-desktop-button mat-hero__primary" href="#contacto">
                Reservá tu clase
              </Button>
              <a className="mat-text-button mat-hero__secondary" href="#hotmat">
                Conocé Hot Mat
              </a>
            </div>
            <span aria-hidden="true" className="mat-hero__spacer" />
          </div>
          <div className="mat-hero__image">
            <Image
              alt="Sala de MAT Pilates"
              className="mat-cropped-image mat-hero__photo"
              height={1448}
              preload
              sizes="(min-width: 1440px) 609px, (min-width: 1280px) calc(38vw + 55px), (min-width: 1024px) calc(39vw - 53px), (min-width: 768px) 720px, calc(100vw - 48px)"
              src="/hero/mat-studio-hero.png"
              width={1086}
            />
            <div className="mat-hero__logo">
              <Image
                alt="MAT Pilates"
                fill
                sizes="(min-width: 1440px) 375px, 58vw"
                src="/brand/mat-hero-mark.svg"
                style={{ objectFit: "contain" }}
              />
            </div>
          </div>
        </section>

        <section aria-labelledby="manifesto-title" className="mat-manifesto">
          <h1
            aria-label={`${manifesto.concepts.join(" · ")} ·`}
            className="mat-manifesto__title"
            id="manifesto-title"
          >
            <span className="mat-manifesto__track">
              {[0, 1].map((copy) => (
                <span aria-hidden="true" className="mat-manifesto__term" key={copy}>
                  {manifesto.concepts.join(" · ")} ·
                </span>
              ))}
            </span>
          </h1>
        </section>

        <section className="mat-hot-mat mat-scroll-target" id="hotmat">
          <div className="mat-section-heading mat-hot-mat__heading">
            <div className="mat-section-heading__title">
              <p className="mat-label">{hotMat.eyebrow}</p>
              <h2 className="mat-h2">{hotMat.title}</h2>
            </div>
            <p className="mat-body mat-section-heading__description">{hotMat.description}</p>
          </div>
          <div className="mat-hot-mat__cards">
            {hotMat.pillars.map((pillar) => (
              <article className="mat-hot-mat__card" key={pillar.number}>
                <div className="mat-hot-mat__card-heading mat-hot-mat__card-heading--wide">
                  <p className="mat-label">
                    {pillar.number} / {pillar.label}
                  </p>
                  <h3 className="mat-h3">{pillar.title}</h3>
                </div>
                <div className="mat-hot-mat__card-heading mat-hot-mat__card-heading--mobile">
                  <p className="mat-label">{pillar.number}</p>
                  <h3 className="mat-h3">{pillar.label}</h3>
                </div>
                <p className="mat-body-small">{pillar.description}</p>
              </article>
            ))}
          </div>
          <p className="mat-body-small mat-hot-mat__closing">{hotMat.closing}</p>
        </section>

        <section className="mat-classes mat-scroll-target" id="clases">
          <div className="mat-section-heading mat-classes__heading">
            <div className="mat-section-heading__title">
              <p className="mat-label">{classes.eyebrow}</p>
              <h2 className="mat-h2">{classes.title}</h2>
            </div>
            <p className="mat-body mat-section-heading__description">{classes.description}</p>
          </div>
          <ul aria-label="Catálogo de clases" className="mat-class-catalog">
            {classCatalog.map((classOffering) => (
              <li className="mat-class-catalog__item" key={classOffering.id}>
                <ClassCard classOffering={classOffering} />
              </li>
            ))}
          </ul>
          <div className="mat-classes__actions">
            <Button
              className="mat-desktop-button mat-classes__button"
              href="#contacto"
              variant="light"
            >
              Reservá tu clase
            </Button>
          </div>
        </section>

        <section className="mat-studio mat-scroll-target" id="estudio">
          <div className="mat-studio__visual">
            <StudioGallery images={studio.images} />
          </div>
          <div className="mat-studio__copy">
            <p className="mat-label">{studio.eyebrow}</p>
            <h2 className="mat-h2">{studio.title}</h2>
            <p className="mat-body-small mat-studio__location">{studio.location}</p>
            <a
              className="mat-text-button mat-studio__link"
              href={siteContact.location.directionsUrl}
              rel="noreferrer"
              target="_blank"
            >
              Cómo llegar
            </a>
            <span aria-hidden="true" className="mat-studio__spacer" />
          </div>
        </section>

        <section className="mat-reservation mat-scroll-target" id="contacto">
          <div className="mat-reservation__copy">
            <p className="mat-label">{reservation.eyebrow}</p>
            <h2 className="mat-h2">{reservation.title}</h2>
            <p className="mat-body">{reservation.description}</p>
            <Button
              className="mat-desktop-button mat-reservation__button"
              href={siteContact.whatsapp.url}
              variant="light"
            >
              Reservá tu clase
            </Button>
            <p className="mat-label mat-reservation__note">{reservation.note}</p>
          </div>
          <div className="mat-reservation__image">
            <Image
              alt="Clase grupal de pilates"
              className="object-cover"
              fill
              sizes="(min-width: 1440px) 632px, (min-width: 1024px) calc(48vw - 67px), (min-width: 768px) 720px, calc(100vw - 48px)"
              src="/sections/reservation-photo.png"
            />
          </div>
        </section>
      </main>
      <SiteFooter />
      <WhatsAppButton />
    </>
  );
}
