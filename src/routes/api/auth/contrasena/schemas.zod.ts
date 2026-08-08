import z from "zod";

export const actualizarContrasenaSchema = z
  .object({
    Contraseña_Actual: z
      .string({ message: "MISSING_CURRENT_PASSWORD" })
      .min(1, "MISSING_CURRENT_PASSWORD")
      .min(8, "CURRENT_PASSWORD_INVALID_LENGTH")
      .max(20, "CURRENT_PASSWORD_INVALID_LENGTH"),

    Nueva_Contraseña: z
      .string({ message: "MISSING_NEW_PASSWORD" })
      .min(1, "MISSING_NEW_PASSWORD")
      .min(8, "NEW_PASSWORD_TOO_SHORT")
      .max(20, "NEW_PASSWORD_TOO_LONG"),
  })
  .refine((data) => data.Contraseña_Actual !== data.Nueva_Contraseña, {
    message: "NEW_PASSWORD_SAME_AS_CURRENT",
    path: ["Nueva_Contraseña"],
  });

export type ActualizarContrasenaInput = z.infer<
  typeof actualizarContrasenaSchema
>;