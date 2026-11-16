"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type Theme = "light" | "dark" | "system"
type ResolvedTheme = "light" | "dark"

const STORAGE_KEY = "theme"
const MEDIA_QUERY = "(prefers-color-scheme: dark)"

type ThemeContextValue = {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

const ThemeContext = React.createContext<ThemeContextValue>({
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => {},
})

function readStoredTheme(fallback: Theme): Theme {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (value === "light" || value === "dark" || value === "system") return value
  } catch {
    // localStorage no disponible (modo privado, etc.)
  }
  return fallback
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement
  root.classList.remove("light", "dark")
  root.classList.add(resolved)
  root.style.colorScheme = resolved
}

/**
 * Proveedor de tema propio (clase "dark" en <html>). El script anti-parpadeo
 * vive en el layout (servidor), por eso este componente no renderiza ningún <script>.
 */
export function ThemeProvider({
  children,
  defaultTheme = "system",
}: {
  children: React.ReactNode
  defaultTheme?: Theme
}) {
  const [theme, setThemeState] = React.useState<Theme>(defaultTheme)
  const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme>("light")
  const [ready, setReady] = React.useState(false)

  // Tras hidratar, se lee la preferencia guardada
  React.useEffect(() => {
    setThemeState(readStoredTheme(defaultTheme))
    setReady(true)
  }, [defaultTheme])

  // Aplica el tema y, en modo "system", sigue los cambios del sistema operativo
  React.useEffect(() => {
    if (!ready) return
    const media = window.matchMedia(MEDIA_QUERY)
    const update = () => {
      const resolved: ResolvedTheme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme
      setResolvedTheme(resolved)
      applyTheme(resolved)
    }
    update()
    if (theme !== "system") return
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [theme, ready])

  const setTheme = React.useCallback((next: Theme) => {
    setThemeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // se ignora: el tema sigue funcionando durante la sesión
    }
  }, [])

  const value = React.useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return React.useContext(ThemeContext)
}

export function ModeToggle() {
  const { setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Evitamos problemas de hidratación en la renderización del cliente/servidor del tema
  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted opacity-0">
        <span className="sr-only">Cambiar tema</span>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Cambiar tema</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="border border-primary/40">
        <DropdownMenuItem onClick={() => setTheme("light")}>Claro</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>Oscuro</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>Sistema</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
