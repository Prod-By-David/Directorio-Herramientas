import { z } from "zod"

import { CATEGORY_VALUES } from "./categories"

export const schema = z.object({
  fullName: z.string().trim().min(1, { message: "El nombre es obligatorio." }),
  email: z.string().trim().email({ message: "Email no válido." }),
  twitterHandle: z
    .string()
    .trim()
    .min(1, { message: "El usuario de X/Twitter es obligatorio." }),

  productWebsite: z
    .string()
    .trim()
    .url({ message: "URL no válida." })
    // z.url() acepta "javascript:..."; solo se permiten enlaces web.
    .refine((v) => /^https?:\/\//i.test(v), {
      message: "La URL debe empezar por http:// o https://",
    }),
  codename: z
    .string()
    .trim()
    .min(1, { message: "El nombre de la herramienta es obligatorio." })
    .max(60, { message: "El nombre admite como máximo 60 caracteres." }),
  punchline: z
    .string()
    .trim()
    .min(1, { message: "El eslogan es obligatorio." })
    .max(60, { message: "El eslogan admite como máximo 60 caracteres." }),
  description: z
    .string()
    .trim()
    .min(1, { message: "La descripción es obligatoria." })
    .max(600, { message: "La descripción admite como máximo 600 caracteres." }),
  categories: z
    .string()
    .trim()
    .min(1, { message: "La categoría es obligatoria." })
    .refine((v) => CATEGORY_VALUES.includes(v), {
      message: "Categoría no válida.",
    }),
  images: z.any(),
  logo_src: z.any().optional(),
})

export const enrichmentSchema = z.object({
  tags: z
    .array(z.string())
    .min(1, { message: "At least one tag is required." }),
  labels: z
    .array(z.string())
    .min(1, { message: "At least one label is required." }),
})
