import Image from "next/image";
import { Button } from "@/components/button";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { methodPillars, schedule } from "@/lib/site-content";

export default function HomePage() {
  return (
    <>
      <div aria-hidden="true" id="inicio" />
      <SiteHeader />
      <main>
        <section className="bg-[var(--mat-surface-default)] lg:h-[698px]">
          <div className="mx-auto max-w-[1232px] px-6 pt-8 pb-12 lg:grid lg:h-full lg:grid-cols-[720px_500px] lg:gap-3 lg:px-0 lg:pt-[79px] lg:pb-[53px]">
            <div className="lg:pt-7">
              <p className="text-xs font-medium tracking-[0.12em] uppercase">
                Pilates MAT · Canning
              </p>
              <h1 className="mt-4 max-w-[720px] text-[2.5rem] font-semibold leading-[1.15] tracking-[-0.05em] lg:mt-12 lg:text-[3.5rem] lg:leading-[60px] lg:tracking-[-1.4px]">
                <span className="lg:hidden">Volvé a habitar tu cuerpo.</span>
                <span className="hidden lg:inline">Volvé a<br />habitar tu cuerpo.</span>
              </h1>
              <p className="mt-4 max-w-[475px] text-base leading-[26px] lg:mt-32 lg:text-xl lg:leading-[30px]">
                Movimiento consciente para ganar fuerza, movilidad y bienestar en tu día a día.
              </p>
              <div className="mt-4 flex items-center gap-[19px] lg:mt-12">
                <Button href="#contacto">Reservá tu clase</Button>
                <a
                  className="hidden text-xs font-medium tracking-[0.0667em] uppercase transition-opacity hover:opacity-60 lg:inline"
                  href="#metodo"
                >
                  Conocé el método&nbsp;&nbsp;→
                </a>
              </div>
              <p className="mt-4 text-xs font-medium leading-4 tracking-[0.0667em] uppercase lg:mt-9">
                Grupos reducidos  ·  Todos los niveles  ·  50 min
              </p>
            </div>
            <div className="relative mt-4 aspect-[342/260] overflow-hidden rounded-[var(--mat-radius-lg)] lg:mt-0 lg:h-[566px] lg:aspect-auto">
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
              <div className="absolute left-1/2 top-1/2 h-[90px] w-[150px] -translate-x-1/2 -translate-y-1/2 lg:h-[132px] lg:w-[222px]">
                <Image alt="MAT Pilates" fill sizes="(min-width: 1024px) 222px, 150px" src="/brand/mat-wordmark-light.svg" style={{ objectFit: "cover" }} />
              </div>
            </div>
          </div>
        </section>

        <section id="metodo" className="landing-section bg-[var(--mat-surface-default)] px-6 py-16 lg:h-[810px] lg:px-0 lg:py-0">
          <div className="mx-auto flex max-w-[1232px] flex-col gap-6 lg:relative lg:block lg:h-full">
            <p className="text-xs font-medium leading-4 tracking-[0.0667em] uppercase lg:absolute lg:left-0 lg:top-[100px]">El método MAT</p>
            <h2 className="text-[2rem] font-medium leading-[38px] tracking-[-0.4px] lg:absolute lg:left-0 lg:top-[150px] lg:w-[630px] lg:text-[2.5rem] lg:font-semibold lg:leading-[46px] lg:tracking-[-0.8px]">
              Más que una clase: <br className="hidden lg:block" />un espacio para vos.
            </h2>
            <p className="text-base leading-[26px] lg:absolute lg:left-[686px] lg:top-[186px] lg:w-[410px]">
              Trabajamos desde la presencia, con una práctica posible y desafiante que se adapta a cada cuerpo.
            </p>
            <div className="grid gap-6 lg:absolute lg:left-0 lg:top-[402px] lg:grid-cols-3 lg:gap-[37px]">
              {methodPillars.map((pillar) => (
                <article key={pillar.number} className="flex h-[147px] flex-col gap-3 rounded-[var(--mat-radius-lg)] bg-[var(--mat-surface-brand)] p-4 lg:h-[205px] lg:w-[386px] lg:gap-0 lg:p-7">
                  <p className="text-xs font-medium leading-4 tracking-[0.0667em]">{pillar.number}</p>
                  <h3 className="text-2xl font-medium leading-[31px] lg:mt-[14px]">{pillar.title}</h3>
                  <p className="text-sm leading-[22px] lg:mt-auto">{pillar.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="clases" className="landing-section bg-[var(--mat-surface-brand)] px-6 py-16 lg:h-[810px] lg:px-0 lg:py-0">
          <div className="mx-auto flex max-w-[1232px] flex-col gap-6 lg:relative lg:block lg:h-full">
            <p className="text-xs font-medium leading-4 tracking-[0.0667em] uppercase lg:absolute lg:left-0 lg:top-[108px]">Clases en el estudio</p>
            <h2 className="text-[2rem] font-medium leading-[38px] tracking-[-0.4px] lg:absolute lg:left-0 lg:top-[158px] lg:w-[570px] lg:text-[2.5rem] lg:font-semibold lg:leading-[46px] lg:tracking-[-0.8px]">
              Tu práctica empieza <br className="hidden lg:block" />donde estás.
            </h2>
            <p className="text-base leading-[26px] lg:absolute lg:left-0 lg:top-[345px] lg:w-[440px]">
              No necesitás experiencia previa. Elegimos el ritmo, la intensidad y el acompañamiento que tu momento necesita.
            </p>
            <article className="relative h-[393px] rounded-[var(--mat-radius-lg)] bg-[var(--mat-surface-default)] lg:absolute lg:left-[662px] lg:top-24 lg:h-[530px] lg:w-[570px]">
              <h3 className="absolute left-6 top-6 text-2xl font-medium leading-[31px] lg:left-11 lg:top-10">Encontrá tu horario</h3>
              <p className="absolute left-6 top-[71px] w-[294px] text-sm leading-[22px] lg:left-11 lg:top-[93px] lg:w-[400px]">
                Elegí la clase que mejor acompaña tu semana.
              </p>
              <ul className="absolute left-6 right-6 top-[131px] space-y-4 lg:left-8 lg:right-8 lg:top-[142px] lg:space-y-4">
                {schedule.map((item) => (
                  <li key={item.name} className="flex h-[46px] items-center justify-between rounded-[var(--mat-radius-md)] bg-[var(--mat-surface-brand)] px-3 text-xs font-medium leading-4 tracking-[0.0667em] uppercase lg:h-[68px] lg:px-5">
                    <span>{item.name}</span>
                    <span className="text-right text-sm font-normal leading-[22px] tracking-normal">{item.time}</span>
                  </li>
                ))}
              </ul>
              <Button className="absolute left-6 top-[317px] lg:left-11 lg:top-[424px] lg:!min-h-11 lg:!py-3" href="#contacto">
                Ver todos los horarios&nbsp;&nbsp;→
              </Button>
            </article>
            <p className="text-xs font-medium leading-4 tracking-[0.0667em] uppercase lg:absolute lg:left-0 lg:top-[574px]">
              Cupos limitados · Reserva previa
            </p>
          </div>
        </section>

        <section id="estudio" className="landing-section bg-[var(--mat-surface-brand)] px-6 py-16 lg:h-[810px] lg:px-0 lg:py-0">
          <div className="mx-auto flex max-w-[1232px] flex-col gap-6 lg:relative lg:block lg:h-full">
            <article className="relative h-[280px] rounded-[var(--mat-radius-lg)] bg-[var(--mat-surface-inverse)] p-6 text-[var(--mat-text-inverse)] lg:absolute lg:left-0 lg:top-[92px] lg:h-[570px] lg:w-[516px] lg:p-0">
              <div className="relative h-[42px] w-28 lg:absolute lg:left-[250px] lg:top-[46px] lg:h-[132px] lg:w-[222px]">
                <Image alt="MAT Pilates" fill sizes="(min-width: 1024px) 222px, 112px" src="/brand/mat-wordmark-light.svg" style={{ objectFit: "cover" }} />
              </div>
              <p className="mt-[30px] max-w-[294px] text-[2rem] font-medium leading-[38px] tracking-[-0.4px] lg:absolute lg:left-[42px] lg:top-[246px] lg:mt-0 lg:max-w-[350px] lg:text-[2.5rem] lg:leading-[46px] lg:tracking-[-0.8px]">
                Un cuerpo que se mueve se siente en casa.
              </p>
              <p className="absolute bottom-6 left-6 text-xs font-medium leading-4 tracking-[0.0667em] uppercase lg:bottom-auto lg:left-11 lg:top-[486px]">MAT Pilates · Movimiento consciente</p>
            </article>
            <p className="text-xs font-medium leading-4 tracking-[0.0667em] uppercase lg:absolute lg:left-[656px] lg:top-[133px]">El estudio</p>
            <h2 className="text-[2rem] font-medium leading-[38px] tracking-[-0.4px] lg:absolute lg:left-[656px] lg:top-[182px] lg:w-[500px] lg:text-[2.5rem] lg:font-semibold lg:leading-[46px] lg:tracking-[-0.8px]">
              Cerca, cálido <br className="hidden lg:block" />y pensado para vos.
            </h2>
            <p className="text-base leading-[26px] lg:absolute lg:left-[656px] lg:top-[367px] lg:w-[420px]">
              Un espacio de práctica en Canning para entrenar con presencia, técnica y acompañamiento real.
            </p>
            <p className="text-xs font-medium leading-4 tracking-[0.0667em] uppercase lg:absolute lg:left-[656px] lg:top-[492px] lg:w-[310px]">
              Canning, Buenos Aires · Grupos reducidos · Todos los niveles
            </p>
            <p className="hidden text-xs font-medium tracking-[0.0667em] uppercase lg:absolute lg:left-[656px] lg:top-[617px] lg:block">Conocé el estudio →</p>
          </div>
        </section>

        <section id="contacto" className="landing-section relative overflow-hidden bg-[var(--mat-surface-inverse)] px-6 py-16 text-[var(--mat-text-inverse)] lg:h-[810px] lg:px-0 lg:py-0">
          <div className="mx-auto flex max-w-[1232px] flex-col gap-6 lg:relative lg:block lg:h-full">
            <div className="pointer-events-none absolute hidden size-[500px] rounded-full bg-[var(--mat-color-gray)] lg:-right-[184px] lg:top-[122px] lg:block" />
            <p className="text-xs font-medium leading-4 tracking-[0.0667em] uppercase lg:absolute lg:left-0 lg:top-[144px]">Tu momento empieza acá</p>
            <h2 className="text-[2rem] font-medium leading-[38px] tracking-[-0.4px] lg:absolute lg:left-0 lg:top-[194px] lg:w-[760px] lg:text-[3.5rem] lg:font-semibold lg:leading-[60px] lg:tracking-[-1.4px]">
              Regalate una hora <br className="hidden lg:block" />para volver a vos.
            </h2>
            <p className="text-base leading-[26px] lg:absolute lg:left-0 lg:top-[390px] lg:w-[450px]">
              Coordinamos tu primera clase y encontramos el horario ideal para tu rutina.
            </p>
            <Button className="lg:absolute lg:left-0 lg:top-[505px]" href="#contacto" variant="light">Reservá tu clase</Button>
            <p className="text-xs font-medium leading-4 tracking-[0.0667em] uppercase lg:absolute lg:left-0 lg:top-[588px]">Te respondemos para coordinar tu lugar</p>
            <p className="hidden text-xs font-medium tracking-[0.0667em] uppercase lg:absolute lg:right-11 lg:top-[610px] lg:block">01 / MAT Pilates</p>
          </div>
        </section>
      </main>
      <SiteFooter />
      <WhatsAppButton />
    </>
  );
}
