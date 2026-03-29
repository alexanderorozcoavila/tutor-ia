import type { Metadata } from "next";
import { Comic_Neue, Press_Start_2P, Bangers } from "next/font/google";
import "./globals.css";

const comicNeue = Comic_Neue({
  weight: ["300", "400", "700"],
  subsets: ["latin"],
  variable: "--font-comic-neue",
});

const pixelFont = Press_Start_2P({
  weight: ["400"],
  subsets: ["latin"],
  variable: "--font-pixel",
});

const comicFont = Bangers({
  weight: ["400"],
  subsets: ["latin"],
  variable: "--font-comic",
});

import { AlertProvider } from "@/lib/AlertContext";
import { AuthProvider } from "@/lib/AuthContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SessionProvider } from "@/components/SessionProvider";

export const metadata: Metadata = {
  title: "IA Tutor - Apoyo a la Lectoescritura",
  description: "Tutor virtual interactivo diseñado para niños con TDA o TEA Nivel 1.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${comicNeue.variable} ${pixelFont.variable} ${comicFont.variable} h-full antialiased`}>
      <body className="font-sans min-h-full flex flex-col bg-slate-50">
        <AlertProvider>
          <AuthProvider>
            <ThemeProvider>
              <SessionProvider>
                {children}
              </SessionProvider>
            </ThemeProvider>
          </AuthProvider>
        </AlertProvider>
      </body>
    </html>
  );
}
