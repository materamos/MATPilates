const defaultSiteUrl = "https://mat-pilates.vercel.app";

function normalizeSiteUrl(value: string) {
  const url = new URL(value);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("SITE_URL must use the http or https protocol.");
  }

  url.pathname = "/";
  url.search = "";
  url.hash = "";

  return url;
}

function resolveSiteUrl() {
  const configuredSiteUrl = process.env.SITE_URL?.trim();

  if (configuredSiteUrl) {
    return normalizeSiteUrl(configuredSiteUrl);
  }

  const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();

  if (vercelProductionUrl) {
    const absoluteVercelUrl = vercelProductionUrl.startsWith("http")
      ? vercelProductionUrl
      : `https://${vercelProductionUrl}`;

    return normalizeSiteUrl(absoluteVercelUrl);
  }

  return new URL(defaultSiteUrl);
}

export const siteMetadata = {
  description:
    "Clases de Hot Mat Pilates, Pilates Mat y movimiento consciente en Canning Center. Conocé MAT Pilates y encontrá la experiencia que acompañe tu momento.",
  language: "es-AR",
  locale: "es_AR",
  name: "MAT Pilates en Canning | Hot Mat Pilates",
  shortName: "MAT Pilates",
  url: resolveSiteUrl(),
} as const;

export const isSiteIndexable =
  process.env.VERCEL_ENV === "production" &&
  process.env.SITE_INDEXING_ENABLED === "true";
