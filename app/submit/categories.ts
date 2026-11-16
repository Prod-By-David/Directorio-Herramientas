// Categorías del formulario (los slugs coinciden con la semilla de la migración).
export const CATEGORY_OPTIONS = [
  { label: "Herramientas de IA", value: "ai-tools" },
  { label: "Agentes de IA", value: "ai-agents" },
  { label: "IA para contenido", value: "ai-content" },
  { label: "Boilerplate", value: "boilerplate" },
  { label: "Analítica", value: "analytics" },
  { label: "Marketing", value: "marketing-tools" },
  { label: "Desarrollo", value: "developer-tools" },
  { label: "E-commerce", value: "e-commerce" },
  { label: "Productividad", value: "productivity" },
  { label: "Diseño", value: "design-tools" },
  { label: "Fintech", value: "fintech" },
  { label: "Educación", value: "education" },
  { label: "SaaS", value: "saas" },
] as const

export const CATEGORY_VALUES: string[] = CATEGORY_OPTIONS.map((c) => c.value)
