import Image from "next/image";
import { Button } from "@/components/button";
import { FeatureCard } from "@/components/feature-card";
import { SectionHeading } from "@/components/section-heading";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { methodPillars, schedule } from "@/lib/site-content";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="inicio">
        <section className="bg-[var(--mat-surface-default)] px-6 pt-12 pb-16 lg:px-12 lg:pt-20 lg:pb-24">
          <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
            <div className="max-w-3xl">
              <p className="text-xs font-medium tracking-[0.12em] uppercase">
                Pilates MAT · Canning
              </p>
              <h1 className="mt-7 max-w-3xl text-5xl font-semibold leading-[0.98] tracking-[-0.055em] sm:text-6xl lg:text-[4.875rem]">
                Volvé a habitar tu cuerpo.
              </h1>
              <p className="mt-8 max-w-xl text-lg leading-8 lg:text-xl">
                Movimiento consciente para ganar fuerza, movilidad y bienestar en tu día a día.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <Button href="#contacto">Reservá tu clase</Button>
                <a
                  className="text-xs font-medium tracking-[0.1em] uppercase transition-opacity hover:opacity-60"
                  href="#metodo"
                >
                  Conocé el método →
                </a>
              </div>
              <p className="mt-9 text-xs font-medium tracking-[0.1em] uppercase">
                Grupos reducidos · Todos los niveles · 50 min
              </p>
            </div>
            <div className="relative min-h-72 overflow-hidden rounded-[var(--mat-radius-lg)] bg-[var(--mat-surface-brand)] sm:min-h-96 lg:min-h-[35rem]">
              <Image
                alt="MAT Pilates"
                fill
                priority
                sizes="(min-width: 1024px) 40vw, 100vw"
                src="/brand/mat-wordmark-dark-on-beige.svg"
                style={{ objectFit: "contain", padding: "20%" }}
              />
            </div>
          </div>
        </section>

        <section id="metodo" className="bg-[var(--mat-surface-default)] px-6 py-16 lg:px-12 lg:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_0.7fr] lg:items-end lg:justify-between">
              <SectionHeading
                eyebrow="El método MAT"
                title="Más que una clase: un espacio para vos."
              />
              <p className="max-w-xl text-base leading-7 lg:pb-2 lg:text-lg">
                Trabajamos desde la presencia, con una práctica posible y desafiante que se adapta a cada cuerpo.
              </p>
            </div>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {methodPillars.map((pillar) => (
                <FeatureCard key={pillar.number} {...pillar} />
              ))}
            </div>
          </div>
        </section>

        <section id="clases" className="bg-[var(--mat-surface-brand)] px-6 py-16 lg:px-12 lg:py-24">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2 lg:items-center lg:gap-20">
            <div>
              <SectionHeading
                eyebrow="Clases en el estudio"
                title="Tu práctica empieza donde estás."
                description="No necesitás experiencia previa. Elegimos el ritmo, la intensidad y el acompañamiento que tu momento necesita."
              />
              <p className="mt-12 text-xs font-medium tracking-[0.1em] uppercase">
                Cupos limitados · Reserva previa
              </p>
            </div>
            <article className="rounded-[var(--mat-radius-lg)] bg-[var(--mat-surface-default)] p-6 sm:p-8">
              <h3 className="text-2xl font-medium tracking-[-0.03em]">Encontrá tu horario</h3>
              <p className="mt-3 text-sm leading-6">Elegí la clase que mejor acompaña tu semana.</p>
              <ul className="mt-7 space-y-3">
                {schedule.map((item) => (
                  <li
                    key={item.name}
                    className="flex items-center justify-between gap-4 rounded-[var(--mat-radius-md)] bg-[var(--mat-surface-brand)] px-4 py-3 text-xs font-medium tracking-[0.08em] uppercase"
                  >
                    <span>{item.name}</span>
                    <span className="text-right">{item.time}</span>
                  </li>
                ))}
              </ul>
              <Button className="mt-7" href="#contacto">
                Ver todos los horarios
              </Button>
            </article>
          </div>
        </section>

        <section id="estudio" className="bg-[var(--mat-surface-brand)] px-6 py-16 lg:px-12 lg:py-24">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2 lg:items-center lg:gap-20">
            <article className="flex min-h-[28rem] flex-col justify-between rounded-[var(--mat-radius-lg)] bg-[var(--mat-surface-inverse)] p-7 text-[var(--mat-text-inverse)] sm:p-10">
              <div className="relative h-10 w-28">
                <Image
                  alt="MAT Pilates"
                  fill
                  sizes="112px"
                  src="/brand/mat-wordmark-light.svg"
                  style={{ objectFit: "contain" }}
                />
              </div>
              <p className="max-w-sm text-4xl font-medium leading-[1.05] tracking-[-0.04em]">
                Un cuerpo que se mueve se siente en casa.
              </p>
              <p className="text-xs font-medium tracking-[0.1em] uppercase">
                MAT Pilates · Movimiento consciente
              </p>
            </article>
            <div>
              <SectionHeading
                eyebrow="El estudio"
                title="Cerca, cálido y pensado para vos."
                description="Un espacio de práctica en Canning para entrenar con presencia, técnica y acompañamiento real."
              />
              <p className="mt-9 max-w-sm text-xs font-medium tracking-[0.1em] uppercase">
                Canning, Buenos Aires · Grupos reducidos · Todos los niveles
              </p>
            </div>
          </div>
        </section>

        <section id="contacto" className="bg-[var(--mat-surface-inverse)] px-6 py-16 text-[var(--mat-text-inverse)] lg:px-12 lg:py-24">
          <div className="mx-auto max-w-7xl">
            <SectionHeading
              eyebrow="Tu momento empieza acá"
              inverse
              title="Regalate una hora para volver a vos."
              description="Coordinamos tu primera clase y encontramos el horario ideal para tu rutina."
            />
            <div className="mt-9">
              <Button href="#contacto" variant="light">
                Reservá tu clase
              </Button>
            </div>
            <p className="mt-7 text-xs font-medium tracking-[0.1em] uppercase">
              Te respondemos para coordinar tu lugar
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
      <WhatsAppButton />
    </>
  );
}
