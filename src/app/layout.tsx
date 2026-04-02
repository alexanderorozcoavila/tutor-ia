import type { Metadata } from "next";
import { Comic_Neue, Press_Start_2P, Bangers, VT323 } from "next/font/google";
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

const vt323 = VT323({
  weight: ["400"],
  subsets: ["latin"],
  variable: "--font-vt323",
});

import { AlertProvider } from "@/lib/AlertContext";
import { AuthProvider } from "@/lib/AuthContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SessionProvider } from "@/components/SessionProvider";
import { SystemMenu } from "@/components/SystemMenu";

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
    <html lang="es" className={`${comicNeue.variable} ${pixelFont.variable} ${comicFont.variable} ${vt323.variable} h-full antialiased`}>
      <body className="font-sans min-h-full flex flex-col bg-slate-50">
        <AlertProvider>
          <AuthProvider>
            <ThemeProvider>
              <SessionProvider>
                {children}
                <SystemMenu />
              </SessionProvider>
            </ThemeProvider>
          </AuthProvider>
        </AlertProvider>
      </body>
    </html>
  );
}
