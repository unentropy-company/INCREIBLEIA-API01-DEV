import { z } from "zod";

export const getSelectorEmpresasQuerySchema = z.object({
  search: z.string().trim().optional(),
  pagina: z.coerce.number().int().positive().default(1),
  limite: z.coerce.number().int().min(1).max(15).default(10),
});

export type GetSelectorEmpresasQuery = z.infer<
  typeof getSelectorEmpresasQuerySchema
>;
