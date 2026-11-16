"use server"

import "server-only"
import { revalidatePath } from "next/cache"
import { createClient } from "@/db/supabase/server"
import { createAdminClient } from "@/db/supabase/admin"

import { getAIEnrichmentPrompt } from "./prompt"
import { enrichmentSchema, schema } from "./schema"

// Configuration object
const config = {
  // El enriquecimiento con IA está desactivado (requiere ANTHROPIC_API_KEY).
  aiEnrichmentEnabled: false,
  aiModelId: "claude-3-haiku-20240307",
  storageBucket: "product-logos",
  cacheControl: "3600",
  allowNewTags: true,
  allowNewLabels: true,
}

const ALLOWED_LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
}
const MAX_LOGO_BYTES = 2 * 1024 * 1024

export type FormState = {
  message: string
  fields?: Record<string, string>
  issues: string[]
}

function isErrorWithMessage(error: unknown): error is Error {
  return typeof error === "object" && error !== null && "message" in error
}

// Sube el logo a <user_id>/<timestamp>.<ext> (la política de storage exige esa carpeta)
async function uploadLogoFile(
  db: Awaited<ReturnType<typeof createClient>>,
  logoFile: File,
  userId: string
): Promise<string> {
  const ext = ALLOWED_LOGO_TYPES[logoFile.type]
  if (!ext) throw new Error("El logo debe ser PNG, JPG o WEBP")
  if (logoFile.size > MAX_LOGO_BYTES) throw new Error("El logo no puede superar 2 MB")

  const filePath = `${userId}/${Date.now()}.${ext}`
  const { error: uploadError } = await db.storage
    .from(config.storageBucket)
    .upload(filePath, Buffer.from(await logoFile.arrayBuffer()), {
      cacheControl: config.cacheControl,
      contentType: logoFile.type,
      upsert: false,
    })

  if (uploadError) {
    console.error(`Error uploading file: ${uploadError.message}`)
    throw new Error("No se pudo subir el logo")
  }

  return db.storage.from(config.storageBucket).getPublicUrl(filePath).data
    .publicUrl
}

// Las tablas de taxonomía solo las escribe el servidor (service role)
async function insertIfNotExists(table: "tags" | "labels", name: string) {
  const { error } = await createAdminClient()
    .from(table)
    .upsert({ name }, { onConflict: "name", ignoreDuplicates: true })
  if (error) throw new Error(`Error inserting into ${table}: ${error.message}`)
}

export async function onSubmitToolAction(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const data = Object.fromEntries(formData.entries())
  const parsed = schema.safeParse(data)

  if (!parsed.success) {
    const fields: Record<string, string> = {}
    for (const key of Object.keys(data)) {
      if (typeof data[key] === "string") fields[key] = data[key] as string
    }
    return {
      message: "Datos no válidos",
      fields,
      issues: parsed.error.issues.map((issue) => issue.message),
    }
  }

  try {
    const db = await createClient()
    const { data: authData, error: authError } = await db.auth.getUser()
    if (authError || !authData.user) {
      throw new Error("Debes iniciar sesión para enviar una herramienta")
    }
    const user = authData.user

    let logoUrl = ""
    const logoFile = formData.get("images")
    if (logoFile instanceof File && logoFile.size > 0) {
      logoUrl = await uploadLogoFile(db, logoFile, user.id)
    }

    let tags: string[] = []
    let labels: string[] = ["unlabeled"]

    if (config.aiEnrichmentEnabled) {
      const { anthropic } = await import("@ai-sdk/anthropic")
      const { generateObject } = await import("ai")
      const { object: enrichment } = await generateObject({
        model: anthropic(config.aiModelId),
        schema: enrichmentSchema,
        prompt: getAIEnrichmentPrompt(
          parsed.data.codename,
          parsed.data.categories,
          parsed.data.description
        ),
      })
      tags = enrichment.tags
      labels = enrichment.labels ?? ["unlabeled"]
      if (config.allowNewTags) for (const t of tags) await insertIfNotExists("tags", t)
      if (config.allowNewLabels) for (const l of labels) await insertIfNotExists("labels", l)
    }

    // Siempre PENDIENTE: lo publica el panel de moderación (y la RLS lo exige).
    const { error } = await db.from("products").insert([
      {
        full_name: parsed.data.fullName,
        email: parsed.data.email,
        twitter_handle: parsed.data.twitterHandle,
        product_website: parsed.data.productWebsite,
        codename: parsed.data.codename,
        punchline: parsed.data.punchline,
        description: parsed.data.description,
        logo_src: logoUrl,
        categories: parsed.data.categories,
        user_id: user.id,
        approved: false,
        tags,
        labels,
      },
    ])

    if (error) {
      if (error.code === "23505") {
        throw new Error("Ya existe una herramienta con ese nombre")
      }
      console.error(`Error inserting product data: ${error.message}`)
      throw new Error("No se pudo guardar la herramienta")
    }

    revalidatePath("/admin")

    return {
      message: "Herramienta enviada. Se publicará cuando el equipo la apruebe.",
      issues: [],
    }
  } catch (error) {
    const msg = isErrorWithMessage(error) ? error.message : "Error desconocido"
    console.error(`Submission failed: ${msg}`)
    return { message: `No se pudo enviar: ${msg}`, issues: [msg] }
  }
}
