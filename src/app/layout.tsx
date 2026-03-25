import type { Metadata } from "next";
import { Comic_Neue } from "next/font/google";
import "./globals.css";

const comicNeue = Comic_Neue({
  weight: ["300", "400", "700"],
  subsets: ["latin"],
  variable: "--font-comic-neue",
});

export const metadata: Metadata = {
  title: "IA Tutor - Apoyo a la Lectoescritura",
  description: "Tutor virtual interactivo diseñado para niños con TDA o TEA Nivel 1.",
};

import { SessionProvider } from "@/components/SessionProvider";
import { Navbar } from "@/components/Navbar";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${comicNeue.variable} h-full antialiased`}>
      <body className="font-sans min-h-full flex flex-col bg-slate-50 pt-16">
        <SessionProvider>
          <Navbar />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
