import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";

import isAdministradorAuthenticated from "../../../../middlewares/isAdministradorAuthenticated";
import isCuentaTemporalAuthenticated from "../../../../middlewares/isCuentaTemporalAuthenticated";
import checkAuthentication from "../../../../middlewares/checkAuthentication";
import {
  getListadoPersonasQuerySchema,
  getUltimosRegistrosQuerySchema,
  registrarPersonaBodySchema,
} from "./schemas.zod";
import { ErrorResponseAPIBase } from "../../../../interfaces/shared/apis/types";
import {
  DataConflictErrorTypes,
  FileErrorTypes,
  SystemErrorTypes,
  ValidationErrorTypes,
} from "../../../../interfaces/shared/errors";
import { r2StorageClient } from "../../../../core/buckets/connectors/CloudfareR2";
import { ADMINISTRADORES_SESSION_EXPIRATION } from "../../../../constants/EXPIRACIONES_JWT";
import {
  ListadoPersonasData,
  PersonaItemListing,
  UltimoRegistroPersonaItem,
} from "../../../../interfaces/shared/apis/api01/personas/types";
import { parsearDocumentoIdentidad } from "../../../../lib/utils/formatters/documentosIdentidad";
import { listarPersonasConDetalles } from "../../../../core/databases/queries/personas/listarPersonasConDetalles";
import { obtenerUltimosRegistrosPersonas } from "../../../../core/databases/queries/personas/obtenerUltimosRegistrosPersonas";
import { obtenerIndicadoresPersonas } from "../../../../core/databases/queries/personas/listarPersonasConIndicadores";
import detallePersonaRouter from "./[identificadorPersona]";
import {
  eliminarPersonaPorIdentificador,
  insertarEmpleadoEmpresa,
  insertarPersona,
  verificarExistenciaEmpresa,
  verificarExistenciaPersonaYEmplazamiento,
} from "../../../../core/databases/queries/personas/registrarPersona";
import { uploadFotoPersonaMiddleware } from "../../../../middlewares/uploadFotoPersona";

const personasRouter = Router();

// =======================================================================================
//                          DOCUMENTACIÓN SWAGGER / OPENAPI (GET /personas)
// =======================================================================================
/**
 * @openapi
 * /clientes/personas:
 *   get:
 *     summary: Obtener listado de personas con filtros avanzados, métricas y certificados
 *     description: >
 *       Retorna una lista paginada de personas con convenciones de nomenclatura en Pascal_Snake_Case.
 *       Permite filtrar por empresa actual utilizando su ID numérico o pasando `0` para filtrar
 *       exclusivamente a las personas que actualmente NO cuentan con una empresa asignada activa.
 *     tags:
 *       - Personas
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         required: false
 *         schema:
 *           type: string
 *         description: "Búsqueda flexible por nombres, apellidos o número de documento (antes del guion)."
 *         example: "Felipe Soto"
 *       - in: query
 *         name: idEmpresa
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: "Identificador de la empresa activa asignada. Mínimo: 0. Si es 0 filtra sin empresa, si es mayor a 0 filtra por el ID correspondiente. Sin valor predeterminado."
 *         example: 0
 *       - in: query
 *         name: tipoDocumento
 *         required: false
 *         schema:
 *           type: string
 *         description: "Tipo de documento (resuelto por el sufijo del identificador: 1 = DNI, 2 = CE, 3 = Pasaporte). Admite valores separados por coma (ej. '1' o '1,2')."
 *         example: "1,2"
 *       - in: query
 *         name: tieneCertificados
 *         required: false
 *         schema:
 *           type: boolean
 *         description: "Filtro por tenencia de certificados: true (al menos 1 certificado), false (0 certificados), o no enviar para omitir el filtro."
 *         example: true
 *       - in: query
 *         name: pagina
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: "Número de página a consultar. Mínimo: 1. Predeterminado: 1."
 *         example: 1
 *       - in: query
 *         name: limite
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 6
 *         description: "Cantidad de registros por página. Mínimo: 1, máximo: 50. Predeterminado: 6."
 *         example: 6
 *     responses:
 *       200:
 *         description: Listado obtenido exitosamente.
 *       400:
 *         description: Parámetros de consulta no válidos.
 *       401:
 *         description: No autorizado - Token JWT ausente o inválido.
 *       500:
 *         description: Error interno al consultar la base de datos.
 */
personasRouter.get(
  "/",
  isAdministradorAuthenticated,
  isCuentaTemporalAuthenticated,
  checkAuthentication,
  async (req: Request, res: Response) => {
    try {
      const queryValidation = getListadoPersonasQuerySchema.safeParse(
        req.query,
      );

      if (!queryValidation.success) {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: "Parámetros de consulta inválidos para el listado",
          errorType: ValidationErrorTypes.INVALID_FORMAT,
        };
        return res.status(400).json(errorResponse);
      }

      const {
        search,
        pagina,
        limite,
        idEmpresa,
        tipoDocumento,
        tieneCertificados,
      } = queryValidation.data;
      const offset = (pagina - 1) * limite;

      const [indicadores, { personas, totalFiltrados }] = await Promise.all([
        obtenerIndicadoresPersonas(),
        listarPersonasConDetalles({
          search,
          idEmpresa,
          tipoDocumento,
          tieneCertificados,
          limite,
          offset,
        }),
      ]);

      const itemsConPresignedUrls: PersonaItemListing[] = await Promise.all(
        personas.map(async (p) => {
          let fotoUrl: string | null = null;
          if (p.Ruta_Foto) {
            try {
              fotoUrl = await r2StorageClient.getPresignedDownloadUrl(
                p.Ruta_Foto,
                ADMINISTRADORES_SESSION_EXPIRATION + 300,
              );
            } catch {
              fotoUrl = null;
            }
          }

          return {
            Identificador_Persona: p.Identificador_Persona,
            Documento: parsearDocumentoIdentidad(p.Identificador_Persona),
            Nombres: p.Nombres,
            Apellidos: p.Apellidos,
            Foto_Perfil_URL: fotoUrl,
            Empresa_Actual: p.Id_Empresa
              ? {
                  Id_Empresa: p.Id_Empresa,
                  Razon_Social: p.Razon_Social!,
                }
              : null,
            Certificados: {
              Vigentes: p.Certificados_Vigentes,
              Vencidos: p.Certificados_Vencidos,
            },
          };
        }),
      );

      const responsePayload: ListadoPersonasData = {
        Indicadores: {
          Total_Personas: indicadores.Total_Personas,
          Total_Personas_Sin_Empresa: indicadores.Total_Personas_Sin_Empresa,
        },
        Total_Resultados_Filtrados: totalFiltrados,
        Pagina_Actual: pagina,
        Total_Paginas: Math.ceil(totalFiltrados / limite) || 1,
        items: itemsConPresignedUrls,
      };

      return res.status(200).json({
        success: true,
        message: "Listado de personas obtenido exitosamente",
        data: responsePayload,
      });
    } catch (error) {
      console.error("Error al obtener listado de personas:", error);
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "Error interno al obtener el listado de personas",
        errorType: SystemErrorTypes.DATABASE_ERROR,
      };
      return res.status(500).json(errorResponse);
    }
  },
);

// =======================================================================================
//                   DOCUMENTACIÓN SWAGGER / OPENAPI (GET /personas/ultimos-registros)
// =======================================================================================
/**
 * @openapi
 * /clientes/personas/ultimos-registros:
 *   get:
 *     summary: Obtener los últimos registros de personas para el widget lateral con foto de perfil
 *     tags:
 *       - Personas
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: diasMaximos
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 0
 *           maximum: 10
 *           default: 0
 *         description: "Días máximos de antigüedad del registro (0 representa únicamente los del día de hoy)."
 *       - in: query
 *         name: limite
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *           default: 5
 *         description: "Cantidad de registros recientes a retornar."
 *     responses:
 *       200:
 *         description: Últimos registros obtenidos exitosamente.
 *       400:
 *         description: Parámetros inválidos.
 *       401:
 *         description: No autorizado.
 *       500:
 *         description: Error interno del servidor.
 */
personasRouter.get(
  "/ultimos-registros",
  isAdministradorAuthenticated,
  isCuentaTemporalAuthenticated,
  checkAuthentication,
  async (req: Request, res: Response) => {
    try {
      const queryValidation = getUltimosRegistrosQuerySchema.safeParse(
        req.query,
      );

      if (!queryValidation.success) {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: "Parámetros inválidos para la consulta de últimos registros",
          errorType: ValidationErrorTypes.INVALID_FORMAT,
        };
        return res.status(400).json(errorResponse);
      }

      const { diasMaximos, limite } = queryValidation.data;
      const registros = await obtenerUltimosRegistrosPersonas(
        diasMaximos,
        limite,
      );

      // Generar URL prefirmada de R2 si la persona tiene foto subida
      const items: UltimoRegistroPersonaItem[] = await Promise.all(
        registros.map(async (p) => {
          let fotoUrl: string | null = null;

          if (p.Ruta_Foto) {
            try {
              fotoUrl = await r2StorageClient.getPresignedDownloadUrl(
                p.Ruta_Foto,
                ADMINISTRADORES_SESSION_EXPIRATION + 300,
              );
            } catch {
              fotoUrl = null;
            }
          }

          return {
            Identificador_Persona: p.Identificador_Persona,
            Documento: parsearDocumentoIdentidad(p.Identificador_Persona),
            Nombres: p.Nombres,
            Apellidos: p.Apellidos,
            Foto_Perfil_URL: fotoUrl,
            Empresa_Actual: p.Id_Empresa
              ? {
                  Id_Empresa: p.Id_Empresa,
                  Razon_Social: p.Razon_Social!,
                }
              : null,
          };
        }),
      );

      return res.status(200).json({
        success: true,
        message: "Últimos registros obtenidos exitosamente",
        data: items,
      });
    } catch (error) {
      console.error("Error al obtener últimos registros:", error);
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "Error interno al obtener los últimos registros",
        errorType: SystemErrorTypes.DATABASE_ERROR,
      };
      return res.status(500).json(errorResponse);
    }
  },
);

/**
 * @openapi
 * /clientes/personas:
 *   post:
 *     summary: Registrar una nueva persona con foto de perfil y vínculo laboral opcional
 *     tags:
 *       - Personas
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - tipoDocumento
 *               - numeroDocumento
 *               - nombres
 *               - apellidos
 *             properties:
 *               tipoDocumento:
 *                 type: string
 *                 enum: ["1", "2", "3"]
 *                 description: "1 = DNI, 2 = CE, 3 = Pasaporte"
 *               numeroDocumento:
 *                 type: string
 *                 example: "72345678"
 *               nombres:
 *                 type: string
 *                 example: "Juan Manuel"
 *               apellidos:
 *                 type: string
 *                 example: "Chávez Saldaña"
 *               celular:
 *                 type: string
 *                 example: "+51987654321"
 *               correo:
 *                 type: string
 *                 example: "usuario@ejemplo.com"
 *               idEmpresa:
 *                 type: integer
 *                 example: 2
 *               cargoEmpleado:
 *                 type: string
 *                 example: "Ingeniero QA"
 *               correoCorporativoEmpleado:
 *                 type: string
 *                 example: "jchavez@empresa.com"
 *               foto:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Persona registrada exitosamente.
 *       400:
 *         description: Parámetros inválidos o formato no soportado.
 *       409:
 *         description: Conflicto - Documento o correo ya en uso, o empresa inexistente.
 *       500:
 *         description: Error interno del servidor.
 */
personasRouter.post(
  "/",
  isAdministradorAuthenticated,
  isCuentaTemporalAuthenticated,
  checkAuthentication,
  (req: Request, res: Response, next: NextFunction) => {
    uploadFotoPersonaMiddleware.single("foto")(req, res, (err: any) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          const errorResponse: ErrorResponseAPIBase = {
            success: false,
            message: "La imagen excede el límite máximo de 5MB",
            errorType: FileErrorTypes.FILE_TOO_LARGE,
          };
          return res.status(400).json(errorResponse);
        }
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: `Error al procesar el archivo: ${err.message}`,
          errorType: FileErrorTypes.FILE_PROCESSING_FAILED,
        };
        return res.status(400).json(errorResponse);
      } else if (err) {
        if (err.message === "INVALID_FILE_TYPE") {
          const errorResponse: ErrorResponseAPIBase = {
            success: false,
            message: "Solo se permiten imágenes en formato JPG, JPEG o PNG",
            errorType: FileErrorTypes.INVALID_FILE_TYPE,
          };
          return res.status(400).json(errorResponse);
        }
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: err.message,
          errorType: FileErrorTypes.FILE_PROCESSING_FAILED,
        };
        return res.status(400).json(errorResponse);
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    let rutaFotoSubida: string | null = null;
    let personaCreadaEnBD = false;
    let identificadorFinal = "";

    try {
      // 1. Validar cuerpo con Zod
      const parseResult = registrarPersonaBodySchema.safeParse(req.body);
      if (!parseResult.success) {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: "Parámetros del formulario inválidos",
          errorType: ValidationErrorTypes.INVALID_FORMAT,
          errors: parseResult.error.flatten().fieldErrors,
        };
        return res.status(400).json(errorResponse);
      }

      const {
        tipoDocumento,
        numeroDocumento,
        nombres,
        apellidos,
        celular,
        correo,
        idEmpresa,
        cargoEmpleado,
        correoCorporativoEmpleado,
      } = parseResult.data;

      // Concatenar formato: {numeroDocumento}-{tipoDocumento}
      identificadorFinal = `${numeroDocumento}-${tipoDocumento}`;

      if (identificadorFinal.length > 20) {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message:
            "El identificador generado excede el límite de 20 caracteres",
          errorType: ValidationErrorTypes.STRING_TOO_LONG,
        };
        return res.status(400).json(errorResponse);
      }

      // 2. Verificar duplicados (409 Conflict)
      const {
        existeIdentificador,
        existeCorreoPersonal,
        existeCorreoCorporativoActivo,
      } = await verificarExistenciaPersonaYEmplazamiento(
        identificadorFinal,
        correo,
        correoCorporativoEmpleado,
      );

      if (existeIdentificador) {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: `Ya existe una persona registrada con el identificador ${identificadorFinal}`,
          errorType: DataConflictErrorTypes.VALUE_ALREADY_IN_USE,
          conflictField: "identificadorPersona",
        };
        return res.status(409).json(errorResponse);
      }

      if (existeCorreoPersonal) {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: `El correo personal '${correo}' ya está registrado por otra persona`,
          errorType: DataConflictErrorTypes.VALUE_ALREADY_IN_USE,
          conflictField: "correo",
        };
        return res.status(409).json(errorResponse);
      }

      if (existeCorreoCorporativoActivo) {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: `El correo corporativo '${correoCorporativoEmpleado}' ya está asignado a un empleo activo`,
          errorType: DataConflictErrorTypes.VALUE_ALREADY_IN_USE,
          conflictField: "correoCorporativoEmpleado",
        };
        return res.status(409).json(errorResponse);
      }

      // 3. Verificar existencia de la empresa si fue enviada (409)
      if (idEmpresa) {
        const empresaExiste = await verificarExistenciaEmpresa(idEmpresa);
        if (!empresaExiste) {
          const errorResponse: ErrorResponseAPIBase = {
            success: false,
            message: `La empresa con ID ${idEmpresa} no existe`,
            errorType: DataConflictErrorTypes.DATABASE_CONSTRAINT,
          };
          return res.status(409).json(errorResponse);
        }
      }

      // 4. Subir imagen a Cloudflare R2 si viene en la petición
      if (req.file) {
        const ext = path.extname(req.file.originalname).toLowerCase() || ".png";
        rutaFotoSubida = `Fotos_Perfil/Personas/${identificadorFinal}${ext}`;

        await r2StorageClient.uploadFile(
          rutaFotoSubida,
          req.file.buffer,
          req.file.mimetype,
        );
      }

      // 5. Inserción SQL de Persona
      const personaCreada = await insertarPersona({
        identificador: identificadorFinal,
        nombres,
        apellidos,
        celular,
        correo,
        rutaFoto: rutaFotoSubida,
      });
      personaCreadaEnBD = true;

      // 6. Inserción SQL de Vinculación Laboral si aplica
      let vinculoLaboral = null;
      if (idEmpresa) {
        vinculoLaboral = await insertarEmpleadoEmpresa({
          idEmpresa,
          idPersona: identificadorFinal,
          cargo: cargoEmpleado,
          correoCorporativo: correoCorporativoEmpleado,
        });
      }

      return res.status(201).json({
        success: true,
        message: "Persona registrada exitosamente",
        data: {
          Identificador_Persona: personaCreada.Identificador_Persona,
          Nombres: personaCreada.Nombres,
          Apellidos: personaCreada.Apellidos,
          Ruta_Foto: personaCreada.Ruta_Foto,
          Fecha_Registro: personaCreada.Fecha_Registro,
          Empresa_Asignada: vinculoLaboral
            ? {
                Id_Empleado_Empresa: vinculoLaboral.Id_Empleado_Empresa,
                Id_Empresa: vinculoLaboral.Id_Empresa,
                Cargo_Empleado: vinculoLaboral.Cargo_Empleado,
                Correo_Corporativo_Empleado:
                  vinculoLaboral.Correo_Corporativo_Empleado,
                Fecha_Asignacion: vinculoLaboral.Fecha_Asignacion,
              }
            : null,
        },
      });
    } catch (error) {
      console.error("Error al registrar persona:", error);

      // Rollback: Borrar imagen subida en Cloudflare R2
      if (rutaFotoSubida) {
        try {
          await r2StorageClient.deleteFile(rutaFotoSubida);
        } catch (r2Err) {
          console.error("Error al compensar borrado en R2:", r2Err);
        }
      }

      // Rollback: Borrar persona de BD si falló el vínculo laboral
      if (personaCreadaEnBD && identificadorFinal) {
        try {
          await eliminarPersonaPorIdentificador(identificadorFinal);
        } catch (dbErr) {
          console.error(
            "Error al compensar inserción en base de datos:",
            dbErr,
          );
        }
      }

      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "Error interno al procesar el registro de la persona",
        errorType: SystemErrorTypes.DATABASE_ERROR,
      };
      return res.status(500).json(errorResponse);
    }
  },
);

personasRouter.use(detallePersonaRouter);

export default personasRouter;
