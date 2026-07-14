import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MAT Pilates Canning",
  description: "Próximamente, un nuevo espacio de bienestar en Canning.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
