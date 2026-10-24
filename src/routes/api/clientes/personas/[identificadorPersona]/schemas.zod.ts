import { z } from "zod";
import { SeccionDetallePersona } from "../../../../../interfaces/shared/apis/api01/personas/[identificadorPersona]/types";

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
