import z from "zod";
import { Genero } from "../../../interfaces/shared/Genero";

export const updateMiPerfilSchema = z.object({
  Nombres: z
    .string({ message: "MISSING_NOMBRES" })
    .trim()
    .min(1, "MISSING_NOMBRES")
    .min(3, "NOMBRES_TOO_SHORT")
    .max(80, "NOMBRES_TOO_LONG"),

  Apellidos: z
    .string({ message: "MISSING_APELLIDOS" })
    .trim()
    .min(1, "MISSING_APELLIDOS")
    .min(5, "APELLIDOS_TOO_SHORT")
    .max(100, "APELLIDOS_TOO_LONG"),

  Genero: z.nativeEnum(Genero, { message: "INVALID_GENERO" }),
});

export type UpdateMiPerfilInput = z.infer<typeof updateMiPerfilSchema>;
