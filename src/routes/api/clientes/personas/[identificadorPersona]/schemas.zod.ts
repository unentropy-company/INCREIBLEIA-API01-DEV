import { z } from "zod";
import { SeccionDetallePersona } from "../../../../../interfaces/shared/apis/api01/personas/[identificadorPersona]/types";

// CONSULTA DE DETALLES

export const getDetallePersonaParamsSchema = z.object({
  idPersona: z
    .string()
    .trim()
    .min(1, "IDENTIFICADOR_REQUIRED")
    .max(20, "IDENTIFICADOR_TOO_LONG"),
});

export const getDetallePersonaQuerySchema = z.object({
  incluir: z
    .nativeEnum(SeccionDetallePersona)
    .default(SeccionDetallePersona.TODOS),
  paginaHistorial: z.coerce.number().int().positive().default(1),
  limiteHistorial: z.coerce.number().int().min(1).max(20).default(5),
});

export type GetDetallePersonaParams = z.infer<
  typeof getDetallePersonaParamsSchema
>;
export type GetDetallePersonaQuery = z.infer<
  typeof getDetallePersonaQuerySchema
>;

// ACTUALIZACION

export const actualizarPersonaBodySchema = z.object({
  nombres: z
    .string()
    .trim()
    .min(2, "Los nombres deben tener al menos 2 caracteres"),
  apellidos: z
    .string()
    .trim()
    .min(2, "Los apellidos deben tener al menos 2 caracteres"),
  celular: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{7,15}$/, "Formato de celular no válido")
    .nullable()
    .optional()
    .transform((val) => (val === "" ? null : (val ?? null))),
  correo: z
    .string()
    .trim()
    .email("Correo electrónico inválido")
    .nullable()
    .optional()
    .transform((val) => (val === "" ? null : (val?.toLowerCase() ?? null))),
  idEmpresa: z
    .preprocess((val) => {
      if (val === "" || val === "null" || val === "0" || val === 0) return null;
      if (val !== undefined && val !== null) return Number(val);
      return undefined;
    }, z.number().int().positive().nullable().optional())
    .default(null),
  cargoEmpleado: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((val) => (val === "" ? null : (val ?? null))),
  correoCorporativoEmpleado: z
    .string()
    .trim()
    .email("Correo corporativo inválido")
    .nullable()
    .optional()
    .transform((val) => (val === "" ? null : (val?.toLowerCase() ?? null))),
});
