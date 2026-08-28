// Font block for src/app/layout.tsx — replaces the Geist local fonts.
// Bodoni Moda = display/headings/prices. Archivo = body, labels, micro-type.

import { Bodoni_Moda, Archivo } from "next/font/google";

const bodoni = Bodoni_Moda({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-bodoni",
  display: "swap",
});

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-archivo",
  display: "swap",
});

// <body className={`${bodoni.variable} ${archivo.variable} antialiased`}>

// Also update the viewport theme colour, which is still champagne:
// export const viewport: Viewport = { themeColor: "#F8F0ED" }
