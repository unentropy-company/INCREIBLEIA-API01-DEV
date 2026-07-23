import z from "zod";

const USERNAME_REGEX = /^[a-z_][a-z0-9_.]*$/;

export const loginCuentaTemporalSchema = z.object({
  Nombre_Usuario: z
    .string({ message: "MISSING_USERNAME" })
    .min(1, "MISSING_USERNAME")
    .min(8, "USERNAME_INVALID")
    .max(20, "USERNAME_INVALID")
    .regex(USERNAME_REGEX, "USERNAME_INVALID"),

  Contraseña: z
    .string({ message: "MISSING_PASSWORD" })
    .min(1, "MISSING_PASSWORD")
    .min(8, "PASSWORD_TOO_SHORT")
    .max(20, "PASSWORD_TOO_LONG"),
});
