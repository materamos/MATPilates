export const instagramUrl = "https://www.instagram.com/matpilatescn/";

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
