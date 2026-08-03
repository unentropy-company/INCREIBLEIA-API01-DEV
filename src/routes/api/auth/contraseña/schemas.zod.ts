import z from "zod";

export const actualizarContrasenaSchema = z.object({
  Contraseña_Actual: z
    .string({ message: "FIELD_REQUIRED" })
    .min(1, "FIELD_REQUIRED"),
  Nueva_Contraseña: z
    .string({ message: "FIELD_REQUIRED" })
    .min(8, "STRING_TOO_SHORT")
    .max(100, "STRING_TOO_LONG"),
});
