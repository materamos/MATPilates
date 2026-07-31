import type { Metadata } from "next";
import localFont from "next/font/local";
import { isSiteIndexable, siteMetadata } from "@/lib/site-metadata";
import "./globals.css";

const neueMontreal = localFont({
  src: [
    {
      path: "./fonts/neue-montreal-regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/neue-montreal-medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/neue-montreal-bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  display: "swap",
  fallback: ["Arial", "Helvetica", "sans-serif"],
  preload: true,
  variable: "--font-neue-montreal",
});

export const metadata: Metadata = {
  metadataBase: siteMetadata.url,
  title: {
    default: siteMetadata.name,
    template: `%s | ${siteMetadata.shortName}`,
  },
  description: siteMetadata.description,
  applicationName: siteMetadata.shortName,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: siteMetadata.locale,
    url: "/",
    siteName: siteMetadata.shortName,
    title: siteMetadata.name,
    description: siteMetadata.description,
  },
  twitter: {
    card: "summary_large_image",
    title: siteMetadata.name,
    description: siteMetadata.description,
  },
  robots: isSiteIndexable
    ? {
        index: true,
        follow: true,
      }
    : {
        index: false,
        follow: false,
        noarchive: true,
      },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className={neueMontreal.variable} lang={siteMetadata.language}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
