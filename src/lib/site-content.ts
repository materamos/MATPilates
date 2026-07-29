const whatsappDisplayNumber = "11-2222-3333";
const whatsappUrl = `https://wa.me/54${whatsappDisplayNumber.replace(/\D/g, "")}`;

export interface ClassOffering {
  id: string;
  name: string;
  tagline: string;
  description: string;
  environment: "hot" | "room-temperature";
}

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
    label: "MAT Pilates · Canning, Buenos Aires",
    mapsUrl: "https://maps.app.goo.gl/FVzpJd571G4QpZPF7",
  },
} as const;

export const navigationItems = [
  { label: "Hot Mat", desktopLabel: "Hot Mat", href: "#hotmat" },
  { label: "Clases", desktopLabel: "Clases", href: "#clases" },
  { label: "El Estudio", desktopLabel: "El estudio", href: "#estudio" },
] as const;

export const footerNavigationItems = navigationItems;

export const landingContent = {
  hero: {
    eyebrow: "MAT Pilates · Canning",
    title: "No se trata solo de entrenar.",
    description:
      "Se trata de conectar con tu cuerpo, explorar tus límites y descubrir una nueva forma de moverte.",
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
  },
  studio: {
    eyebrow: "El estudio",
    title: "Cerca, cálido y pensado para vos.",
    description:
      "Un espacio de práctica en Canning para entrenar con presencia, técnica y acompañamiento real.",
    manifesto: "Un cuerpo que se mueve se siente en casa.",
    manifestoLabel: "MAT Pilates · Movimiento consciente",
    location: "Canning Center · Mariano Castex 1560, Canning",
    details: ["Todos los niveles"],
  },
  reservation: {
    eyebrow: "Tu momento empieza acá",
    title: "Regalate una hora para volver a vos.",
    description:
      "Coordinamos tu primera clase y encontramos el horario ideal para tu rutina.",
    note: "Te respondemos para coordinar tu lugar",
  },
} as const;

export const classCatalog = [
  {
    id: "hot-sculpt",
    name: "HOT SCULPT",
    tagline: "Esculpí, fortalecé y tonificá.",
    description:
      "Una clase de Pilates Mat de intensidad intermedia que combina movimientos dinámicos y controlados para fortalecer todo el cuerpo. El calor y la tecnología infrarroja potencian la activación muscular, la movilidad y la sensación de bienestar, logrando un entrenamiento desafiante y efectivo.",
    environment: "hot",
  },
  {
    id: "hot-pilates-stretch",
    name: "HOT PILATES & STRETCH",
    tagline: "Fuerza y flexibilidad en equilibrio.",
    description:
      "Una combinación de Pilates Mat y estiramientos profundos. La primera parte de la clase desarrolla fuerza, estabilidad y control, mientras que la segunda se enfoca en liberar tensiones, mejorar la movilidad y favorecer la recuperación muscular, todo en un ambiente cálido con infrarrojos.",
    environment: "hot",
  },
  {
    id: "yoga",
    name: "YOGA",
    tagline: "Movimiento, respiración y conexión.",
    description:
      "Una práctica que une respiración consciente, fuerza, equilibrio y flexibilidad. Ideal para reducir el estrés, mejorar la movilidad y conectar cuerpo y mente a través de secuencias fluidas y posturas sostenidas.",
    environment: "room-temperature",
  },
  {
    id: "hot-mat-burn",
    name: "HOT MAT BURN",
    tagline: "Máxima intensidad. Máximos resultados.",
    description:
      "Una clase de alta intensidad diseñada para elevar la frecuencia cardíaca, fortalecer el cuerpo completo y mejorar la resistencia. Combina ejercicios dinámicos de Pilates Mat con un ritmo desafiante en una sala climatizada con calor e infrarrojos.",
    environment: "hot",
  },
  {
    id: "mat-pilates",
    name: "MAT PILATES",
    tagline: "El método clásico, sin calor.",
    description:
      "Una clase de Pilates Mat realizada a temperatura ambiente que prioriza la técnica, el control, la respiración y la correcta ejecución de cada movimiento. Ideal para todos los niveles.",
    environment: "room-temperature",
  },
  {
    id: "hot-booty",
    name: "HOT BOOTY",
    tagline: "Glúteos fuertes. Piernas potentes.",
    description:
      "Entrenamiento enfocado en glúteos, piernas y core mediante ejercicios específicos de Pilates y resistencia. El calor ayuda a crear una experiencia intensa y energizante mientras se trabaja la fuerza y la estabilidad.",
    environment: "hot",
  },
  {
    id: "hot-sweat",
    name: "HOT & SWEAT",
    tagline: "Movete. Transpirá. Superate.",
    description:
      "Una clase intensa y dinámica que combina fuerza, resistencia y movimientos continuos para lograr un entrenamiento de cuerpo completo. Diseñada para quienes buscan desafiar sus límites y disfrutar de una sesión de alta energía en calor e infrarrojos.",
    environment: "hot",
  },
  {
    id: "abs-on",
    name: "ABS ON",
    tagline: "Core activado de principio a fin.",
    description:
      "Clase enfocada en fortalecer el abdomen, la zona lumbar y toda la musculatura del core. Mejora la postura, el equilibrio y la estabilidad mediante ejercicios específicos e intensos realizados en una sala climatizada con calor e infrarrojos.",
    environment: "hot",
  },
  {
    id: "stretch-glow",
    name: "STRETCH GLOW",
    tagline: "Movilidad, relajación y bienestar.",
    description:
      "Una experiencia enfocada en estirar, recuperar y liberar tensiones. A través de ejercicios de movilidad y estiramientos guiados, el calor y la tecnología infrarroja favorecen la relajación muscular y una agradable sensación de renovación.",
    environment: "hot",
  },
  {
    id: "sculpt-flow",
    name: "SCULPT & FLOW",
    tagline: "Fuerza con movimiento fluido.",
    description:
      "Una clase que combina bloques de tonificación con secuencias continuas de Pilates Mat. Desarrolla fuerza, coordinación, equilibrio y flexibilidad en una experiencia dinámica y armoniosa, realizada con calor e infrarrojos.",
    environment: "hot",
  },
  {
    id: "stretching",
    name: "STRETCHING",
    tagline: "Flexibilidad y recuperación.",
    description:
      "Clase dedicada a mejorar la movilidad, aumentar el rango de movimiento y aliviar la tensión muscular mediante estiramientos guiados. Ideal para complementar cualquier entrenamiento o simplemente regalarle al cuerpo un momento de recuperación.",
    environment: "room-temperature",
  },
] as const satisfies readonly ClassOffering[];
