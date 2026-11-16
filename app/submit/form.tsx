"use client"

import { useActionState, useEffect, useRef, useTransition } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { X } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FileUploader } from "@/components/cult/file-drop"
import { GradientHeading } from "@/components/cult/gradient-heading"

import { StyledButton } from "../login/submit-button"
import { onSubmitToolAction, type FormState } from "./action"
import { CATEGORY_OPTIONS } from "./categories"
import { schema } from "./schema"

const initialState: FormState = { message: "", issues: [] }

export const SubmitTool = () => {
  const router = useRouter()
  const [isTransitionPending, startTransition] = useTransition()

  const [state, formAction, isActionPending] = useActionState(
    onSubmitToolAction,
    initialState
  )
  const loading = isTransitionPending || isActionPending

  const form = useForm<z.output<typeof schema>>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      fullName: "",
      email: "",
      twitterHandle: "",
      productWebsite: "",
      codename: "",
      punchline: "",
      description: "",
      images: [],
      logo_src: "",
      categories: "",
    },
  })

  const { isValid } = form.formState
  const formRef = useRef<HTMLFormElement>(null)

  // Solo se navega a la home si el envío fue correcto
  useEffect(() => {
    if (!state.message) return
    if (state.issues.length > 0) {
      toast.error(state.issues.join(", "))
    } else {
      toast.success(state.message)
      router.push("/")
    }
  }, [state, router])

  return (
    <Form {...form}>
      {state.issues.length > 0 && (
        <div className="text-red-500">
          <ul>
            {state.issues.map((issue) => (
              <li key={issue} className="flex gap-1">
                <X fill="red" />
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}
      <form
        ref={formRef}
        className="space-y-8"
        onSubmit={(evt) => {
          evt.preventDefault()
          form.handleSubmit(() => {
            const formData = new FormData(formRef.current!)
            const logoFile = form.getValues("images")
            if (logoFile && logoFile.length > 0) {
              formData.set("images", logoFile[0])
            }
            startTransition(() => formAction(formData))
          })(evt)
        }}
      >
        <GradientHeading size="xs">Empecemos por tus datos</GradientHeading>
        <div className="flex flex-wrap gap-1 md:gap-2">
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre completo</FormLabel>
                <FormControl>
                  <Input placeholder="Nombre completo" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="Email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="twitterHandle"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tu usuario de X/Twitter</FormLabel>
                <FormControl>
                  <Input placeholder="@usuario" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="productWebsite"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Web de la herramienta</FormLabel>
                <FormControl>
                  <Input placeholder="https://tuherramienta.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <GradientHeading size="xs">Cuéntanos sobre tu herramienta</GradientHeading>
        <FormField
          control={form.control}
          name="codename"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre de la herramienta</FormLabel>
              <FormControl>
                <Input placeholder="Nombre de la herramienta" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="punchline"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Eslogan (máx. 60 caracteres)</FormLabel>
              <FormControl>
                <Input placeholder="Eslogan" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descripción breve (máx. 600 caracteres)</FormLabel>
              <FormControl>
                <Input placeholder="Descripción breve" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="images"
          render={({ field }) => (
            <div className="space-y-6">
              <FormItem className="w-full">
                <FormLabel>Logo (PNG, JPG o WEBP, máx. 2 MB)</FormLabel>
                <FormControl>
                  <FileUploader
                    value={field.value}
                    onValueChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            </div>
          )}
        />
        <FormField
          control={form.control}
          name="categories"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Categoría</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
                {...field}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Se usa para clasificar tu herramienta en el directorio.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {isValid && (
          <StyledButton disabled={loading} type="submit">
            {loading ? "Enviando..." : "Enviar"}
          </StyledButton>
        )}
      </form>
    </Form>
  )
}

export default SubmitTool
