"use client"

import { Dialog } from "@radix-ui/react-dialog"

import { Button } from "@/components/ui/button"
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

import { SubmitButton } from "./submit-button"

export function ResetPassword({
  handleResetPassword,
}: {
  handleResetPassword: any
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">¿Olvidaste tu contraseña?</Button>
      </DialogTrigger>
      <DialogContent className="h-[240px] w-[400px] p-4">
        <DialogHeader>
          <DialogTitle>Recuperar contraseña</DialogTitle>
          <DialogDescription>
            Introduce tu email para recibir las instrucciones.
          </DialogDescription>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cerrar
            </Button>
          </DialogClose>
        </DialogHeader>

        <form className="animate-in flex-1 flex flex-col w-full justify-center gap-2 text-foreground">
          <label className="text-md" htmlFor="email">
            Email
          </label>
          <Input type="email" name="email" placeholder="tu@email.com" required />
          <SubmitButton
            formAction={handleResetPassword}
            className="button border border-foreground/20 rounded-md px-4 py-2 text-foreground mb-2"
            pendingText="Enviando..."
          >
            Enviar instrucciones
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  )
}
