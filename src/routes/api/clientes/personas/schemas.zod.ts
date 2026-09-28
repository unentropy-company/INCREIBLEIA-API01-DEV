import z from "zod";

export const getListadoPersonasQuerySchema = z.object({
  search: z.string().trim().optional(),
  pagina: z.coerce.number().int().positive().default(1),
  limite: z.coerce.number().int().positive().max(50).default(6),
  idEmpresa: z.coerce.number().int().positive().optional(),
  // Soporta valores únicos (1) o listas separadas por comas ("1,2")
  tipoDocumento: z
    .string()
    .trim()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const ids = val
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => [1, 2, 3].includes(n));
      return ids.length > 0 ? ids : undefined;
    }),
  tieneCertificados: z
    .preprocess((val) => {
      if (val === "true" || val === true || val === 1 || val === "1")
        return true;
      if (val === "false" || val === false || val === 0 || val === "0")
        return false;
      return undefined;
    }, z.boolean().optional())
    .optional(),
});

export const getUltimosRegistrosQuerySchema = z.object({
  diasMaximos: z.coerce.number().int().min(0).max(10).default(0),
  limite: z.coerce.number().int().positive().max(5).default(5),
});

export type GetListadoPersonasQuery = z.infer<
  typeof getListadoPersonasQuerySchema
>;

export type GetUltimosRegistrosQuery = z.infer<
  typeof getUltimosRegistrosQuerySchema
>;
