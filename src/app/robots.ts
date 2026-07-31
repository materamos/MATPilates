import type { MetadataRoute } from "next";
import { isSiteIndexable, siteMetadata } from "@/lib/site-metadata";

export default function robots(): MetadataRoute.Robots {
  if (!isSiteIndexable) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: new URL("/sitemap.xml", siteMetadata.url).toString(),
    host: siteMetadata.url.origin,
  };
}
