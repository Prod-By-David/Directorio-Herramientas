import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { createClient } from "@/db/supabase/server"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { ResetPassword } from "./reset-password"
import { SubmitButton } from "./submit-button"

const msg = (text: string) => `/login?message=${encodeURIComponent(text)}`

async function getOrigin() {
  return (
    (await headers()).get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000"
  )
}

export function LoginForm() {
  const signIn = async (formData: FormData) => {
    "use server"

    const email = String(formData.get("email") ?? "")
    const password = String(formData.get("password") ?? "")
    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) return redirect(msg("No se pudo iniciar sesión. Revisa tu email y contraseña."))
    return redirect("/submit")
  }

  const signUp = async (formData: FormData) => {
    "use server"

    const origin = await getOrigin()
    const email = String(formData.get("email") ?? "")
    const password = String(formData.get("password") ?? "")
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
      },
    })
    if (error) return redirect(msg(`No se pudo crear la cuenta: ${error.message}`))
    // Con confirmación de email activada no hay sesión hasta que se confirma
    if (data.session) return redirect("/submit")
    return redirect(
      msg("Cuenta creada. Revisa tu email para confirmarla y después inicia sesión.")
    )
  }

  const handleResetPassword = async (formData: FormData) => {
    "use server"

    const origin = await getOrigin()
    const email = String(formData.get("email") ?? "")
    const supabase = await createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/login/password`,
    })
    if (error) return redirect(msg(error.message))
    return redirect(msg("Revisa tu email para restablecer la contraseña"))
  }

  return (
    <div className="w-full flex flex-col items-center justify-center gap-2  ">
      <Tabs defaultValue="login">
        <TabsList>
          <TabsTrigger value="login">Acceder</TabsTrigger>
          <TabsTrigger value="signup">Crear cuenta</TabsTrigger>
        </TabsList>
        <TabsContent value="login">
          <Card className="mx-auto w-[20rem] md:w-[24rem]">
            <CardHeader>
              <CardTitle className="text-2xl">Acceder</CardTitle>
              <CardDescription>
                Introduce tus datos para acceder a tu cuenta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    placeholder="tu@email.com"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="login-password">Contraseña</Label>
                  <Input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    name="password"
                    placeholder="••••••••"
                  />
                </div>

                <SubmitButton
                  formAction={signIn}
                  className="button-secondary rounded-md px-4 py-2 text-foreground mb-2"
                  pendingText="Accediendo..."
                >
                  Acceder
                </SubmitButton>
              </form>
            </CardContent>
            <CardFooter>
              <ResetPassword handleResetPassword={handleResetPassword} />
            </CardFooter>
          </Card>
        </TabsContent>
        <TabsContent value="signup">
          <Card className="mx-auto w-[20rem] md:w-[24rem]">
            <CardHeader>
              <CardTitle className="text-2xl">Crear cuenta</CardTitle>
              <CardDescription>
                Introduce tus datos para crear una cuenta
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* <form className="animate-in flex-1 flex flex-col w-full justify-center gap-2 text-foreground"> */}
              <form className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    placeholder="tu@email.com"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="signup-password">Contraseña</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    name="password"
                    placeholder="••••••••"
                  />
                </div>

                <SubmitButton
                  formAction={signUp}
                  className="button-secondary rounded-md px-4 py-2 text-foreground mb-2"
                  pendingText="Creando cuenta..."
                >
                  Crear cuenta
                </SubmitButton>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
