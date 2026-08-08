import z from "zod";


export const confirmarCambioCorreoSchema = z.object({
  Codigo_OTP: z
    .string({ message: "FIELD_REQUIRED" })
    .trim()
    .length(6, "STRING_LENGTH_INVALID")
    .regex(/^\d+$/, "INVALID_FORMAT"),
});