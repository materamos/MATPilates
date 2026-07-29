import type { Metadata } from "next";
import localFont from "next/font/local";
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
  title: "MAT Pilates Canning",
  description:
    "Hot Mat Pilates y Mat Pilates en Canning Center. Una experiencia cercana, consciente y enfocada en el bienestar.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className={neueMontreal.variable} lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
