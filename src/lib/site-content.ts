const whatsappDisplayNumber = "11-4022-9138";
const whatsappInternationalNumber = `+54${whatsappDisplayNumber.replace(/\D/g, "")}`;
const whatsappUrl = `https://wa.me/${whatsappInternationalNumber.slice(1)}`;
const whatsappUrlWithMessage = (message: string) =>
  `${whatsappUrl}?text=${encodeURIComponent(message)}`;

const sitePostalAddress = {
  streetAddress: "Mariano Castex 1560",
  addressLocality: "Canning",
  addressRegion: "Buenos Aires",
  addressCountry: "AR",
} as const;

const siteCoordinates = {
  latitude: -34.8630031,
  longitude: -58.5018518,
} as const;

export const landingCtas = {
  explore: {
    href: "#clases",
    label: "Elegí tu experiencia",
  },
  join: {
    href: "#contacto",
    label: "Sumate a MAT",
  },
  learnHowToJoin: {
    href: "#contacto",
    label: "Conocé cómo sumarte",
  },
  selectExperience: {
    label: "Quiero esta experiencia",
  },
  learnHotMat: {
    href: "#hotmat",
    label: "¿Qué es Hot Mat?",
  },
  directions: {
    label: "Cómo llegar",
  },
} as const;

export function getClassWhatsappUrl(className: string) {
  return whatsappUrlWithMessage(`Hola, quiero sumarme a MAT. Me interesa ${className}.`);
}

export interface ClassOffering {
  id: string;
  name: string;
  tagline: string;
  description: string;
  intensity: "low" | "moderate" | "high";
  environment: "hot" | "room-temperature";
}

export const classIntensityLabels = {
  low: "Baja",
  moderate: "Moderada",
  high: "Alta",
} as const satisfies Record<ClassOffering["intensity"], string>;

export const siteContact = {
  instagram: {
    url: "https://www.instagram.com/matpilatescn/",
  },
  whatsapp: {
    displayNumber: whatsappDisplayNumber,
    internationalNumber: whatsappInternationalNumber,
    joinUrl: whatsappUrlWithMessage(
      "Hola, quiero sumarme a MAT y conocer qué experiencia puede acompañarme.",
    ),
    url: whatsappUrl,
  },
  location: {
    venue: "Canning Center",
    address: `${sitePostalAddress.streetAddress}, ${sitePostalAddress.addressLocality}`,
    label: "MAT Pilates · Canning, Buenos Aires",
    postalAddress: sitePostalAddress,
    coordinates: siteCoordinates,
    mapsUrl: "https://maps.app.goo.gl/FVzpJd571G4QpZPF7",
    embedUrl:
      "https://www.google.com/maps/embed?origin=mfe&pb=!1m3!2m1!1s-34.8630031,-58.5018518!6i17",
    directionsUrl:
      "https://www.google.com/maps/dir/?api=1&destination=-34.8630031%2C-58.5018518",
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
    concepts: ["Movimiento", "Presencia", "Bienestar"],
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
    description: "Todas las clases están pensadas para trabajar con presencia y progresión.",
  },
  schedule: {
    eyebrow: "Semana",
    title: "Horarios",
  },
  studio: {
    eyebrow: "El estudio",
    title: "Cerca, cálido y pensado para vos.",
    images: [
      {
        alt: "Interior del estudio MAT Pilates con paneles infrarrojos encendidos",
        src: "/sections/studio/mat-pilates-studio-interior-heaters-wide.png",
      },
      {
        alt: "Equipamiento de MAT Pilates preparado sobre el piso del estudio",
        src: "/sections/studio/mat-pilates-studio-equipment-shelf-floor.png",
      },
    ],
    location: "Canning Center · Mariano Castex 1560, Canning",
  },
  reservation: {
    eyebrow: "Tu momento empieza acá",
    title: "Encontrá tu forma de moverte.",
    description:
      "Conocé las propuestas de MAT y descubrí cuál acompaña mejor tu momento.",
    note: "Cada experiencia empieza con un primer paso",
  },
} as const;

export const classCatalog = [
  {
    id: "hot-sculpt",
    name: "HOT SCULPT",
    tagline: "Esculpí, fortalecé y tonificá.",
    description:
      "Una clase de Pilates Mat de intensidad intermedia que combina movimientos dinámicos y controlados para fortalecer todo el cuerpo. El calor y la tecnología infrarroja potencian la activación muscular, la movilidad y la sensación de bienestar, logrando un entrenamiento desafiante y efectivo.",
    intensity: "moderate",
    environment: "hot",
  },
  {
    id: "hot-pilates-stretch",
    name: "HOT PILATES & STRETCH",
    tagline: "Fuerza y flexibilidad en equilibrio.",
    description:
      "Una combinación de Pilates Mat y estiramientos profundos. La primera parte de la clase desarrolla fuerza, estabilidad y control, mientras que la segunda se enfoca en liberar tensiones, mejorar la movilidad y favorecer la recuperación muscular, todo en un ambiente cálido con infrarrojos.",
    intensity: "moderate",
    environment: "hot",
  },
  {
    id: "yoga",
    name: "YOGA",
    tagline: "Movimiento, respiración y conexión.",
    description:
      "Una práctica que une respiración consciente, fuerza, equilibrio y flexibilidad. Ideal para reducir el estrés, mejorar la movilidad y conectar cuerpo y mente a través de secuencias fluidas y posturas sostenidas.",
    intensity: "low",
    environment: "room-temperature",
  },
  {
    id: "hot-mat-burn",
    name: "HOT MAT BURN",
    tagline: "Máxima intensidad. Máximos resultados.",
    description:
      "Una clase de alta intensidad diseñada para elevar la frecuencia cardíaca, fortalecer el cuerpo completo y mejorar la resistencia. Combina ejercicios dinámicos de Pilates Mat con un ritmo desafiante en una sala climatizada con calor e infrarrojos.",
    intensity: "high",
    environment: "hot",
  },
  {
    id: "mat-pilates",
    name: "MAT PILATES",
    tagline: "El método clásico, sin calor.",
    description:
      "Una clase de Pilates Mat realizada a temperatura ambiente que prioriza la técnica, el control, la respiración y la correcta ejecución de cada movimiento. Ideal para todos los niveles.",
    intensity: "low",
    environment: "room-temperature",
  },
  {
    id: "hot-booty",
    name: "HOT BOOTY",
    tagline: "Glúteos fuertes. Piernas potentes.",
    description:
      "Entrenamiento enfocado en glúteos, piernas y core mediante ejercicios específicos de Pilates y resistencia. El calor ayuda a crear una experiencia intensa y energizante mientras se trabaja la fuerza y la estabilidad.",
    intensity: "high",
    environment: "hot",
  },
  {
    id: "hot-sweat",
    name: "HOT & SWEAT",
    tagline: "Movete. Transpirá. Superate.",
    description:
      "Una clase intensa y dinámica que combina fuerza, resistencia y movimientos continuos para lograr un entrenamiento de cuerpo completo. Diseñada para quienes buscan desafiar sus límites y disfrutar de una sesión de alta energía en calor e infrarrojos.",
    intensity: "high",
    environment: "hot",
  },
  {
    id: "abs-on",
    name: "ABS ON",
    tagline: "Core activado de principio a fin.",
    description:
      "Clase enfocada en fortalecer el abdomen, la zona lumbar y toda la musculatura del core. Mejora la postura, el equilibrio y la estabilidad mediante ejercicios específicos e intensos realizados en una sala climatizada con calor e infrarrojos.",
    intensity: "moderate",
    environment: "hot",
  },
  {
    id: "stretch-glow",
    name: "STRETCH GLOW",
    tagline: "Movilidad, relajación y bienestar.",
    description:
      "Una experiencia enfocada en estirar, recuperar y liberar tensiones. A través de ejercicios de movilidad y estiramientos guiados, el calor y la tecnología infrarroja favorecen la relajación muscular y una agradable sensación de renovación.",
    intensity: "low",
    environment: "hot",
  },
  {
    id: "sculpt-flow",
    name: "SCULPT & FLOW",
    tagline: "Fuerza con movimiento fluido.",
    description:
      "Una clase que combina bloques de tonificación con secuencias continuas de Pilates Mat. Desarrolla fuerza, coordinación, equilibrio y flexibilidad en una experiencia dinámica y armoniosa, realizada con calor e infrarrojos.",
    intensity: "moderate",
    environment: "hot",
  },
  {
    id: "stretching",
    name: "STRETCHING",
    tagline: "Flexibilidad y recuperación.",
    description:
      "Clase dedicada a mejorar la movilidad, aumentar el rango de movimiento y aliviar la tensión muscular mediante estiramientos guiados. Ideal para complementar cualquier entrenamiento o simplemente regalarle al cuerpo un momento de recuperación.",
    intensity: "low",
    environment: "room-temperature",
  },
] as const satisfies readonly ClassOffering[];

export type ClassId = (typeof classCatalog)[number]["id"];
