import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MAT Pilates Canning",
  description:
    "Hot Pilates y Mat Pilates en Canning Center. Una experiencia cercana, consciente y enfocada en el bienestar.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
