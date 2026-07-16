import Image from "next/image";
import { Button } from "@/components/button";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { methodPillars, schedule, siteContact } from "@/lib/site-content";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section id="inicio" className="landing-hero scroll-mt-20 bg-[var(--mat-surface-default)] xl:h-[698px] xl:scroll-mt-28">
          <div className="landing-hero__inner mx-auto max-w-[1232px] px-6 pt-6 pb-8 xl:grid xl:h-full xl:grid-cols-[720px_500px] xl:gap-3 xl:px-0 xl:pt-[79px] xl:pb-[53px]">
            <div className="landing-hero__copy xl:pt-7">
              <p className="text-xs font-medium tracking-[0.12em] uppercase">
                Pilates MAT · Canning
              </p>
              <h1 className="landing-hero__title mt-4 max-w-[720px] text-[2.5rem] font-semibold leading-[1.15] tracking-[-0.05em] xl:mt-12 xl:text-[3.5rem] xl:leading-[60px] xl:tracking-[-1.4px]">
                <span className="lg:hidden">Volvé a habitar tu cuerpo.</span>
                <span className="hidden lg:inline">Volvé a<br />habitar tu cuerpo.</span>
              </h1>
              <p className="landing-hero__description mt-4 max-w-[475px] text-base leading-[26px] xl:mt-32 xl:text-xl xl:leading-[30px]">
                Movimiento consciente para ganar fuerza, movilidad y bienestar en tu día a día.
              </p>
              <div className="landing-hero__actions mt-4 flex items-center gap-[19px] xl:mt-12">
                <Button href="#contacto">Reservá tu clase</Button>
                <a
                  className="hidden text-xs font-medium tracking-[0.0667em] uppercase transition-opacity hover:opacity-60 lg:inline"
                  href="#metodo"
                >
                  Conocé el método&nbsp;&nbsp;→
                </a>
              </div>
              <p className="landing-hero__details mt-4 text-xs font-medium leading-4 tracking-[0.0667em] uppercase xl:mt-9">
                Grupos reducidos  ·  Todos los niveles  ·  50 min
              </p>
            </div>
            <div className="landing-hero__image relative mt-4 aspect-[342/260] overflow-hidden rounded-[var(--mat-radius-lg)] xl:mt-0 xl:h-[566px] xl:aspect-auto">
              <Image
                alt="Sala de MAT Pilates"
                fill
                priority
                sizes="(min-width: 1024px) 500px, 342px"
                src="/hero/mat-studio-hero.png"
                className="object-cover"
                unoptimized
              />
              <div className="absolute inset-0 bg-[var(--mat-color-charcoal)] opacity-[0.28]" />
              <div className="absolute left-1/2 top-1/2 h-[90px] w-[150px] -translate-x-1/2 -translate-y-1/2 xl:h-[132px] xl:w-[222px]">
                <Image alt="MAT Pilates" fill sizes="(min-width: 1024px) 222px, 150px" src="/brand/mat-wordmark-light.svg" style={{ objectFit: "cover" }} />
              </div>
            </div>
          </div>
        </section>

        <section id="metodo" className="landing-section landing-section--method scroll-mt-20 bg-[var(--mat-surface-default)] px-6 py-12 xl:h-[810px] xl:scroll-mt-28 xl:px-0 xl:py-0">
          <div className="landing-section__content landing-section__content--method mx-auto flex max-w-[1232px] flex-col gap-6 xl:relative xl:block xl:h-full">
            <p className="landing-method__eyebrow text-xs font-medium leading-4 tracking-[0.0667em] uppercase xl:absolute xl:left-0 xl:top-[100px]">El método MAT</p>
            <h2 className="landing-method__title text-[2rem] font-medium leading-[38px] tracking-[-0.4px] xl:absolute xl:left-0 xl:top-[150px] xl:w-[630px] xl:text-[2.5rem] xl:font-semibold xl:leading-[46px] xl:tracking-[-0.8px]">
              Más que una clase: <br className="hidden lg:block" />un espacio para vos.
            </h2>
            <p className="landing-method__description text-base leading-[26px] xl:absolute xl:left-[686px] xl:top-[186px] xl:w-[410px]">
              Trabajamos desde la presencia, con una práctica posible y desafiante que se adapta a cada cuerpo.
            </p>
            <div className="landing-method__cards grid gap-6 xl:absolute xl:left-0 xl:top-[402px] xl:grid-cols-3 xl:gap-[37px]">
              {methodPillars.map((pillar) => (
                <article key={pillar.number} className="flex h-[147px] flex-col gap-3 rounded-[var(--mat-radius-lg)] bg-[var(--mat-surface-brand)] p-4 xl:h-[205px] xl:w-[386px] xl:gap-0 xl:p-7">
                  <p className="text-xs font-medium leading-4 tracking-[0.0667em]">{pillar.number}</p>
                  <h3 className="text-2xl font-medium leading-[31px] xl:mt-[14px]">{pillar.title}</h3>
                  <p className="text-sm leading-[22px] xl:mt-auto">{pillar.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="clases" className="landing-section landing-section--classes scroll-mt-20 bg-[var(--mat-surface-brand)] px-6 py-12 xl:h-[650px] xl:scroll-mt-28 xl:px-0 xl:py-0">
          <div className="landing-section__content landing-section__content--classes mx-auto flex max-w-[1232px] flex-col gap-6 xl:relative xl:block xl:h-full">
            <p className="landing-classes__eyebrow text-xs font-medium leading-4 tracking-[0.0667em] uppercase xl:absolute xl:left-0 xl:top-[108px]">Clases en el estudio</p>
            <h2 className="landing-classes__title text-[2rem] font-medium leading-[38px] tracking-[-0.4px] xl:absolute xl:left-0 xl:top-[158px] xl:w-[570px] xl:text-[2.5rem] xl:font-semibold xl:leading-[46px] xl:tracking-[-0.8px]">
              Tu práctica empieza <br className="hidden lg:block" />donde estás.
            </h2>
            <p className="landing-classes__description text-base leading-[26px] xl:absolute xl:left-0 xl:top-[345px] xl:w-[440px]">
              No necesitás experiencia previa. Elegimos el ritmo, la intensidad y el acompañamiento que tu momento necesita.
            </p>
            <article className="landing-classes__schedule relative h-[393px] rounded-[var(--mat-radius-lg)] bg-[var(--mat-surface-default)] xl:absolute xl:left-[662px] xl:top-24 xl:h-[530px] xl:w-[570px]">
              <h3 className="absolute left-6 top-6 text-2xl font-medium leading-[31px] xl:left-11 xl:top-10">Encontrá tu horario</h3>
              <p className="absolute left-6 top-[71px] w-[294px] text-sm leading-[22px] xl:left-11 xl:top-[93px] xl:w-[400px]">
                Elegí la clase que mejor acompaña tu semana.
              </p>
              <ul className="absolute left-6 right-6 top-[131px] space-y-4 xl:left-8 xl:right-8 xl:top-[142px] xl:space-y-4">
                {schedule.map((item) => (
                  <li key={item.name} className="flex h-[46px] items-center justify-between rounded-[var(--mat-radius-md)] bg-[var(--mat-surface-brand)] px-3 text-xs font-medium leading-4 tracking-[0.0667em] uppercase xl:h-[68px] xl:px-5">
                    <span>{item.name}</span>
                    <span className="text-right text-sm font-normal leading-[22px] tracking-normal">{item.time}</span>
                  </li>
                ))}
              </ul>
              <Button className="absolute left-6 top-[317px] xl:left-11 xl:top-[424px] xl:!min-h-11 xl:!py-3" href="#contacto">
                Ver todos los horarios&nbsp;&nbsp;→
              </Button>
            </article>
            <p className="landing-classes__note text-xs font-medium leading-4 tracking-[0.0667em] uppercase xl:absolute xl:left-0 xl:top-[574px]">
              Cupos limitados · Reserva previa
            </p>
          </div>
        </section>

        <section id="estudio" className="landing-section landing-section--studio scroll-mt-20 bg-[var(--mat-surface-brand)] px-6 py-12 xl:h-[810px] xl:scroll-mt-28 xl:px-0 xl:py-0">
          <div className="landing-section__content landing-section__content--studio mx-auto flex max-w-[1232px] flex-col gap-6 xl:relative xl:block xl:h-full">
            <article className="landing-studio__card relative h-[280px] rounded-[var(--mat-radius-lg)] bg-[var(--mat-surface-inverse)] p-6 text-[var(--mat-text-inverse)] xl:absolute xl:left-0 xl:top-[92px] xl:h-[570px] xl:w-[516px] xl:p-0">
              <div className="relative h-[42px] w-28 xl:absolute xl:left-[250px] xl:top-[46px] xl:h-[132px] xl:w-[222px]">
                <Image alt="MAT Pilates" fill sizes="(min-width: 1024px) 222px, 112px" src="/brand/mat-wordmark-light.svg" style={{ objectFit: "cover" }} />
              </div>
              <p className="mt-[30px] max-w-[294px] text-[2rem] font-medium leading-[38px] tracking-[-0.4px] xl:absolute xl:left-[42px] xl:top-[246px] xl:mt-0 xl:max-w-[350px] xl:text-[2.5rem] xl:leading-[46px] xl:tracking-[-0.8px]">
                Un cuerpo que se mueve se siente en casa.
              </p>
              <p className="absolute bottom-6 left-6 text-xs font-medium leading-4 tracking-[0.0667em] uppercase xl:bottom-auto xl:left-11 xl:top-[486px]">MAT Pilates · Movimiento consciente</p>
            </article>
            <p className="landing-studio__eyebrow text-xs font-medium leading-4 tracking-[0.0667em] uppercase xl:absolute xl:left-[656px] xl:top-[133px]">El estudio</p>
            <h2 className="landing-studio__title text-[2rem] font-medium leading-[38px] tracking-[-0.4px] xl:absolute xl:left-[656px] xl:top-[182px] xl:w-[500px] xl:text-[2.5rem] xl:font-semibold xl:leading-[46px] xl:tracking-[-0.8px]">
              Cerca, cálido <br className="hidden lg:block" />y pensado para vos.
            </h2>
            <p className="landing-studio__description text-base leading-[26px] xl:absolute xl:left-[656px] xl:top-[367px] xl:w-[420px]">
              Un espacio de práctica en Canning para entrenar con presencia, técnica y acompañamiento real.
            </p>
            <p className="landing-studio__note text-xs font-medium leading-4 tracking-[0.0667em] uppercase xl:absolute xl:left-[656px] xl:top-[492px] xl:w-[310px]">
              {siteContact.location.address}
            </p>
            <a
              className="landing-studio__link hidden text-xs font-medium tracking-[0.0667em] uppercase transition-opacity hover:opacity-60 lg:block xl:absolute xl:left-[656px] xl:top-[617px]"
              href={siteContact.location.mapsUrl}
              rel="noreferrer"
              target="_blank"
            >
              Conocé el estudio →
            </a>
          </div>
        </section>

        <section id="contacto" className="landing-section landing-section--contact relative scroll-mt-20 overflow-hidden bg-[var(--mat-surface-inverse)] px-6 py-12 text-[var(--mat-text-inverse)] xl:h-[810px] xl:scroll-mt-28 xl:px-0 xl:py-0">
          <div className="landing-section__content landing-section__content--contact mx-auto flex max-w-[1232px] flex-col gap-6 xl:relative xl:block xl:h-full">
            <div className="landing-contact__shape pointer-events-none absolute hidden rounded-full bg-[var(--mat-color-gray)] lg:block xl:size-[500px] xl:-right-[184px] xl:top-[122px]" />
            <p className="landing-contact__eyebrow text-xs font-medium leading-4 tracking-[0.0667em] uppercase xl:absolute xl:left-0 xl:top-[144px]">Tu momento empieza acá</p>
            <h2 className="landing-contact__title text-[2rem] font-medium leading-[38px] tracking-[-0.4px] xl:absolute xl:left-0 xl:top-[194px] xl:w-[760px] xl:text-[3.5rem] xl:font-semibold xl:leading-[60px] xl:tracking-[-1.4px]">
              Regalate una hora <br className="hidden lg:block" />para volver a vos.
            </h2>
            <p className="landing-contact__description text-base leading-[26px] xl:absolute xl:left-0 xl:top-[390px] xl:w-[450px]">
              Coordinamos tu primera clase y encontramos el horario ideal para tu rutina.
            </p>
            <Button className="landing-contact__action xl:absolute xl:left-0 xl:top-[505px]" href={siteContact.whatsapp.url} variant="light">Reservá tu clase</Button>
            <p className="landing-contact__note text-xs font-medium leading-4 tracking-[0.0667em] uppercase xl:absolute xl:left-0 xl:top-[588px]">Te respondemos para coordinar tu lugar</p>
            <p className="landing-contact__index hidden text-xs font-medium tracking-[0.0667em] uppercase lg:block xl:absolute xl:right-11 xl:top-[610px]">01 / MAT Pilates</p>
          </div>
        </section>
      </main>
      <SiteFooter />
      <WhatsAppButton />
    </>
  );
}
