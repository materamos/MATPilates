import Image from "next/image";
import { Button } from "@/components/button";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { landingContent, schedule, siteContact } from "@/lib/site-content";

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
                Conocé Hot Mat <span aria-hidden="true">→</span>
              </a>
            </div>
            <span aria-hidden="true" className="mat-hero__spacer" />
          </div>
          <div className="mat-hero__image">
            <Image
              alt="Sala de MAT Pilates"
              className="mat-cropped-image mat-hero__photo"
              height={1448}
              loading="eager"
              priority
              sizes="(min-width: 1440px) 609px, calc(100vw - 48px)"
              src="/hero/mat-studio-hero.png"
              unoptimized
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
          <div className="mat-manifesto__copy">
            <p className="mat-label">{manifesto.eyebrow}</p>
            <h2 className="mat-h2" id="manifesto-title">
              {manifesto.title}
            </h2>
          </div>
          <div className="mat-manifesto__graphic">
            <Image
              alt=""
              aria-hidden="true"
              className="mat-manifesto__graphic-image"
              height={1080}
              sizes="(min-width: 1440px) 543px, calc(100vw - 48px)"
              src="/sections/manifesto-graphic.png"
              width={1920}
            />
          </div>
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
          <article className="mat-schedule">
            <div className="mat-schedule__intro">
              <p className="mat-label">{classes.panelEyebrow}</p>
              <h3 className="mat-h3">
                {classes.panelTitle.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </h3>
              <p className="mat-body-small">{classes.panelDescription}</p>
              <Button className="mat-desktop-button mat-schedule__button" href="#contacto">
                Reservá tu clase
              </Button>
            </div>
            <div className="mat-schedule__times">
              <ul className="mat-schedule__list">
                {schedule.map((item) => (
                  <li className="mat-schedule__row" key={item.name}>
                    <span className="mat-text-button">{item.name}</span>
                    <span className="mat-body-small mat-schedule__time mat-schedule__time--wide">
                      {item.time}
                    </span>
                    <span className="mat-body-small mat-schedule__time mat-schedule__time--mobile">
                      {item.mobileTime}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mat-label mat-schedule__details mat-schedule__details--wide">
                {classes.details}
              </p>
              <p className="mat-label mat-schedule__details mat-schedule__details--mobile">
                {classes.mobileDetails}
              </p>
            </div>
          </article>
        </section>

        <section className="mat-studio mat-scroll-target" id="estudio">
          <div className="mat-studio__visual">
            <div className="mat-studio__manifesto">
              <p className="mat-h3">{studio.manifesto}</p>
              <p className="mat-label">{studio.manifestoLabel}</p>
            </div>
            <div className="mat-studio__image">
              <Image
                alt="Interior del estudio MAT Pilates"
                className="mat-cropped-image mat-studio__photo"
                height={1448}
                sizes="(min-width: 1280px) 622px, (min-width: 1024px) 432px, calc(100vw - 48px)"
                src="/hero/mat-studio-hero.png"
                unoptimized
                width={1086}
              />
            </div>
          </div>
          <div className="mat-studio__copy">
            <p className="mat-label">{studio.eyebrow}</p>
            <h2 className="mat-h2">{studio.title}</h2>
            <p className="mat-body mat-studio__description">{studio.description}</p>
            <div className="mat-studio__details">
              <p className="mat-label">{studio.location}</p>
              <p className="mat-body-small">
                {studio.details.map((detail) => (
                  <span key={detail}>{detail}</span>
                ))}
              </p>
            </div>
            <a
              className="mat-text-button mat-studio__link"
              href={siteContact.location.mapsUrl}
              rel="noreferrer"
              target="_blank"
            >
              Conocé el estudio <span aria-hidden="true">→</span>
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
              sizes="(min-width: 1440px) 601px, calc(100vw - 48px)"
              src="/sections/reservation-photo.png"
              unoptimized
            />
          </div>
        </section>
      </main>
      <SiteFooter />
      <WhatsAppButton />
    </>
  );
}
