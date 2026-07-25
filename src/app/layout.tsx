import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MAT Pilates Canning",
  description: "Movimiento, equilibrio y transformación en Canning.",
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
