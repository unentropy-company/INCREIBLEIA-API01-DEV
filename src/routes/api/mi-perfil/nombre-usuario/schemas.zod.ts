import z from "zod";

const USERNAME_REGEX = /^[a-z_][a-z0-9_.]*$/;

export const actualizarNombreUsuarioSchema = z.object({
  Nombre_Usuario: z
    .string({ message: "MISSING_USERNAME" })
    .min(1, "MISSING_USERNAME")
    .min(8, "USERNAME_INVALID")
    .max(20, "USERNAME_INVALID")
    .regex(USERNAME_REGEX, "USERNAME_INVALID"),
});

export type ActualizarNombreUsuarioInput = z.infer<
  typeof actualizarNombreUsuarioSchema
>;