import z from "zod";

export const solicitarCambioCorreoSchema = z.object({
  Nuevo_Correo_Electronico: z
    .string({ message: "FIELD_REQUIRED" })
    .min(1, "FIELD_REQUIRED")
    .email("INVALID_EMAIL")
    .max(150, "STRING_TOO_LONG"),
});
