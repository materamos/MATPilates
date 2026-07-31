import type { MetadataRoute } from "next";
import { siteMetadata } from "@/lib/site-metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteMetadata.url.toString(),
    },
  ];
}
