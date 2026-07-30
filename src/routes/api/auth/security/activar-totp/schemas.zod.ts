import z from "zod";

export const activarTotpSchema = z.object({
  Contraseña: z
    .string({ message: "MISSING_PASSWORD" })
    .min(1, "MISSING_PASSWORD")
    .min(8, "PASSWORD_TOO_SHORT")
    .max(20, "PASSWORD_TOO_LONG"),
});

export type ActivarTotpInput = z.infer<typeof activarTotpSchema>;
