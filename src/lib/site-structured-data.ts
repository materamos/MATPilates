import { siteContact } from "@/lib/site-content";
import { siteMetadata } from "@/lib/site-metadata";

function absoluteSiteUrl(path: string) {
  return new URL(path, siteMetadata.url).toString();
}

export const localBusinessStructuredData = {
  "@context": "https://schema.org",
  "@type": "ExerciseGym",
  "@id": absoluteSiteUrl("/#studio"),
  name: siteMetadata.shortName,
  description: siteMetadata.description,
  url: siteMetadata.url.toString(),
  telephone: siteContact.whatsapp.internationalNumber,
  image: [
    absoluteSiteUrl("/opengraph-image.png"),
    absoluteSiteUrl("/hero/mat-studio-hero.png"),
    absoluteSiteUrl("/sections/reservation-photo.png"),
  ],
  logo: absoluteSiteUrl("/icon.svg"),
  address: {
    "@type": "PostalAddress",
    ...siteContact.location.postalAddress,
  },
  geo: {
    "@type": "GeoCoordinates",
    ...siteContact.location.coordinates,
  },
  hasMap: siteContact.location.mapsUrl,
  sameAs: [siteContact.instagram.url],
} as const;
