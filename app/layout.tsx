import "./globals.css"
import type { ReactNode } from "react"
import type { Metadata } from "next"
import localFont from "next/font/local"

import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

import { ThemeProvider } from "./providers"

// (sin export: un layout solo puede exportar campos propios de Next)
const fontSans = localFont({
  src: "../fonts/haskoy.ttf",
  variable: "--font-sans",
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

const title = "Directorio de herramientas de IA y software"
const description =
  "Descubre y compara herramientas de IA y software. Envía la tuya gratis y consigue una posición destacada."

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  keywords: "herramientas IA, software, SaaS, directorio, startups",
  openGraph: { title, description, type: "website" },
  twitter: { card: "summary_large_image", title, description },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={`${fontSans.variable} font-sans  `}>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>
            <main className="bg-[#FAFAFA] dark:bg-background  text-foreground flex flex-col justify-center items-center w-full pt-13">
              <div className=" w-full ">{children}</div>
            </main>
          </TooltipProvider>
          <Toaster richColors />
        </ThemeProvider>
      </body>
    </html>
  )
}
