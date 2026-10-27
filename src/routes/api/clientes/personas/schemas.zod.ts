import z from "zod";

// ESQUEMAS DE CONSULTA DE PERSONAS

export const getListadoPersonasQuerySchema = z.object({
  search: z.string().trim().optional(),
  pagina: z.coerce.number().int().positive().default(1),
  limite: z.coerce.number().int().positive().max(50).default(6),
  // .nonnegative() permite 0 y enteros positivos
  idEmpresa: z.coerce.number().int().nonnegative().optional(),
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
      if (val === "true" || val === true || val === 1 || val === "1") return true;
      if (val === "false" || val === false || val === 0 || val === "0") return false;
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


// ESQUEMAS DE REGISTRO DE PERSONA

export const TipoDocumentoEnum = z.enum(["1", "2", "3"]); // 1 = DNI, 2 = CE, 3 = Pasaporte

export const registrarPersonaBodySchema = z.object({
  tipoDocumento: TipoDocumentoEnum,
  numeroDocumento: z
    .string()
    .trim()
    .min(1, "El número de documento es requerido")
    .max(18, "El número de documento no puede superar los 18 caracteres")
    .regex(/^[a-zA-Z0-9]+$/, "El número de documento solo debe contener caracteres alfanuméricos"),
  nombres: z
    .string()
    .trim()
    .min(1, "El nombre es requerido")
    .max(80, "Los nombres no pueden exceder 80 caracteres"),
  apellidos: z
    .string()
    .trim()
    .min(1, "El apellido es requerido")
    .max(100, "Los apellidos no pueden exceder 100 caracteres"),
  celular: z
    .string()
    .trim()
    .max(20, "El celular no puede exceder 20 caracteres")
    .optional()
    .nullable()
    .transform((val) => (val === "" || val === undefined ? null : val)),
  correo: z
    .string()
    .trim()
    .email("Formato de correo electrónico inválido")
    .max(200, "El correo no puede exceder 200 caracteres")
    .optional()
    .nullable()
    .transform((val) => (val === "" || val === undefined ? null : val)),
  // Vinculación opcional con empresa
  idEmpresa: z
    .preprocess((val) => {
      if (val === "" || val === undefined || val === null || val === "null") return null;
      const parsed = Number(val);
      return isNaN(parsed) ? val : parsed;
    }, z.number().int().positive("El ID de la empresa debe ser mayor a 0").nullable().optional())
    .default(null),
  cargoEmpleado: z
    .string()
    .trim()
    .max(150, "El cargo no puede exceder 150 caracteres")
    .optional()
    .nullable()
    .transform((val) => (val === "" || val === undefined ? null : val)),
  correoCorporativoEmpleado: z
    .string()
    .trim()
    .email("Formato de correo corporativo inválido")
    .max(255, "El correo corporativo no puede exceder 255 caracteres")
    .optional()
    .nullable()
    .transform((val) => (val === "" || val === undefined ? null : val)),
});

export type RegistrarPersonaInput = z.infer<typeof registrarPersonaBodySchema>;