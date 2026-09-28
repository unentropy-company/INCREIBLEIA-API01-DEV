import { z } from "zod";
import { TiposDocumentosIdentidad } from "../../../../interfaces/shared/TiposDocumentosIdentidad";

export const getListadoPersonasQuerySchema = z.object({
  search: z.string().trim().optional(),
  pagina: z.coerce.number().int().positive().default(1),
  limite: z.coerce.number().int().positive().max(50).default(6),
  idEmpresa: z.coerce.number().int().positive().optional(),
  tipoDocumento: z.coerce
    .number()
    .int()
    .refine((val) => [1, 2, 3].includes(val), {
      message: "INVALID_DOCUMENT_TYPE",
    })
    .transform((val) => val as TiposDocumentosIdentidad)
    .optional(),
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
  limite: z.coerce.number().int().positive().max(20).default(5),
});

export type GetListadoPersonasQuery = z.infer<
  typeof getListadoPersonasQuerySchema
>;

export type GetUltimosRegistrosQuery = z.infer<
  typeof getUltimosRegistrosQuerySchema
>;
