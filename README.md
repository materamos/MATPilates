# MAT Pilates

Landing pública de MAT Pilates en Canning, con apertura prevista para el 25 de julio de 2026.

## Alcance actual

La aplicación presenta la identidad del estudio, su método, las clases, los horarios informativos y un bloque de contacto en una única landing responsive.

Incluye:

- secciones de método, clases, estudio y contacto;
- navegación interna e integración con Instagram;
- sistema visual reutilizable con tokens, componentes y tipografía Montserrat;
- recursos de marca SVG y favicon adaptativo para esquemas claro y oscuro.

## Stack

- Next.js 16 con App Router
- React 19 y TypeScript
- Tailwind CSS 4
- ESLint

## Requisitos

- Node.js 20.9 o superior
- npm

## Instalación

```bash
npm install
```

## Comandos

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Inicia el servidor de desarrollo con Turbopack. |
| `npm run lint` | Ejecuta las reglas de ESLint. |
| `npm run build` | Genera el build de producción y valida TypeScript. |
| `npm run start` | Inicia la aplicación compilada; requiere ejecutar `npm run build` antes. |

Para validar los cambios principales:

```bash
npm run lint
npm run build
```

## Estructura del repositorio

| Ruta | Responsabilidad |
| --- | --- |
| `src/app/` | Rutas, layout global, estilos y metadatos de la aplicación. |
| `src/components/` | Componentes de interfaz reutilizables. |
| `src/lib/` | Datos y utilidades compartidas, incluido el contenido estructurado de la landing. |
| `public/` | Recursos estáticos públicos, como las variantes de marca. |
| `docs/` | Decisiones y documentación técnica complementaria. |

## Documentación adicional

- [Sistema de diseño](docs/design-system.md)
- [Convenciones del repositorio](AGENTS.md)
