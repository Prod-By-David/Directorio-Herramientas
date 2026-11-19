"use client"

import { FC, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/db/supabase/client"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

const MIN_LENGTH = 8

export const ChangePassword: FC = () => {
  const router = useRouter()

  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleResetPassword = async () => {
    if (!newPassword) return toast.info("Introduce tu nueva contraseña.")
    if (newPassword.length < MIN_LENGTH)
      return toast.error(`La contraseña debe tener al menos ${MIN_LENGTH} caracteres.`)
    if (newPassword !== confirmPassword)
      return toast.error("Las contraseñas no coinciden.")

    setLoading(true)
    const db = createClient()
    const { error } = await db.auth.updateUser({ password: newPassword })
    setLoading(false)
    if (error) return toast.error("No se pudo cambiar la contraseña.")

    toast.success("Contraseña cambiada correctamente.")
    return router.push("/login")
  }

  return (
    <Dialog open={true}>
      <DialogContent className="h-[260px] w-[400px] p-4">
        <DialogHeader>
          <DialogTitle>Cambiar contraseña</DialogTitle>
          <DialogDescription>
            Elige una contraseña nueva (mínimo 8 caracteres).
          </DialogDescription>
        </DialogHeader>

        <Input
          id="password"
          placeholder="Nueva contraseña"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />

        <Input
          id="confirmPassword"
          placeholder="Confirmar nueva contraseña"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <DialogFooter>
          <Button onClick={handleResetPassword} disabled={loading}>
            {loading ? "Guardando..." : "Confirmar cambio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
