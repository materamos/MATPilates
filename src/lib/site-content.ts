const whatsappDisplayNumber = "11-2222-3333";
const whatsappUrl = `https://wa.me/54${whatsappDisplayNumber.replace(/\D/g, "")}`;

export const siteContact = {
  instagram: {
    url: "https://www.instagram.com/matpilatescn/",
  },
  whatsapp: {
    displayNumber: whatsappDisplayNumber,
    url: whatsappUrl,
  },
  location: {
    venue: "Canning Center",
    address: "Mariano Castex 1560, Canning",
    label: "Pilates MAT · Canning, Buenos Aires",
    mapsUrl: "https://maps.app.goo.gl/FVzpJd571G4QpZPF7",
  },
} as const;

export const navigationItems = [
  { label: "Hot Mat", href: "#metodo" },
  { label: "Clases", href: "#clases" },
  { label: "Estudio", href: "#estudio" },
] as const;

export const landingContent = {
  hero: {
    eyebrow: "Pilates MAT · Canning",
    title: "Volvé a habitar tu cuerpo.",
    description:
      "Una práctica consciente para ganar fuerza, movilidad y conexión en tu día a día.",
    details: "Grupos reducidos · Todos los niveles · 50 min",
  },
  manifesto: {
    eyebrow: "Movimiento · Presencia · Bienestar",
    title: "Un cuerpo que se mueve se siente en casa.",
  },
  hotMat: {
    eyebrow: "Hot Mat",
    title: "El calor no es solo para transpirar.",
    description:
      "En MAT, el calor infrarrojo es parte de la práctica. Acompaña la entrada en movimiento, prepara el cuerpo para explorar con más fluidez y transforma cómo se siente cada clase.",
    closing: "Una forma distinta de entrar en movimiento.",
    pillars: [
      {
        number: "01",
        label: "Activación",
        title: "Movimiento desde el comienzo.",
        description:
          "El calor acompaña el inicio de la práctica para que conectes con tu fuerza desde el primer ejercicio.",
      },
      {
        number: "02",
        label: "Movilidad",
        title: "Más movilidad. Menos rigidez.",
        description:
          "Con el cuerpo ya preparado, los movimientos se sienten más fluidos y cómodos desde los primeros minutos.",
      },
      {
        number: "03",
        label: "Sensación",
        title: "Calor que se siente diferente.",
        description:
          "Una experiencia envolvente que suma foco, energía y presencia a cada clase.",
      },
    ],
  },
  classes: {
    eyebrow: "Clases",
    title: "Encontrá la clase que acompañe tu momento.",
    description:
      "Elegí la propuesta que acompañe tu momento. Todas las clases están pensadas para trabajar con presencia y progresión.",
    panelEyebrow: "Encontrá tu horario",
    panelTitle: ["Una práctica", "para cada ritmo."],
    panelDescription:
      "Tres propuestas para empezar, sostener o intensificar tu práctica.",
    details: "Grupos reducidos · Todos los niveles · 50 min",
  },
  studio: {
    eyebrow: "El estudio",
    title: "Cerca, cálido y pensado para vos.",
    description:
      "Un espacio de práctica en Canning para entrenar con presencia, técnica y acompañamiento real.",
    manifesto: "Un cuerpo que se mueve se siente en casa.",
    manifestoLabel: "MAT Pilates · Movimiento consciente",
    location: "Canning, Buenos Aires",
    details: ["Grupos reducidos", "Todos los niveles"],
  },
  reservation: {
    eyebrow: "Tu momento empieza acá",
    title: "Regalate una hora para volver a vos.",
    description:
      "Coordinamos tu primera clase y encontramos el horario ideal para tu rutina.",
    note: "Te respondemos para coordinar tu lugar",
  },
} as const;

export const schedule = [
  { name: "MAT INICIAL", time: "LUNES · MIÉRCOLES · 09:00" },
  { name: "MAT FLOW", time: "MARTES · JUEVES · 18:30" },
  { name: "MAT FUERZA", time: "SÁBADO · 10:00" },
] as const;
