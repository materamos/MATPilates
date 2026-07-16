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
  { label: "Método", href: "#metodo" },
  { label: "Clases", href: "#clases" },
  { label: "Estudio", href: "#estudio" },
] as const;

export const methodPillars = [
  {
    number: "01",
    title: "Fuerza real",
    description: "Estabilidad y control para sentirte más fuerte dentro y fuera del mat.",
  },
  {
    number: "02",
    title: "Movilidad activa",
    description: "Amplitud y fluidez para moverte con menos rigidez y más confianza.",
  },
  {
    number: "03",
    title: "Conexión presente",
    description: "Una hora para respirar, registrar y volver a elegirte.",
  },
] as const;

export const schedule = [
  { name: "MAT INICIAL", time: "LUN · MIE · 09:00" },
  { name: "MAT FLOW", time: "MAR · JUE · 18:30" },
  { name: "MAT FUERZA", time: "SÁB · 10:00" },
] as const;
