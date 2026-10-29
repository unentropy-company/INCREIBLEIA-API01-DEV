import { Router, Request, Response, NextFunction } from "express";
import path from "path";
import multer from "multer";

import {
  getDetallePersonaParamsSchema,
  getDetallePersonaQuerySchema,
  actualizarPersonaBodySchema,
} from "./schemas.zod";
import isAdministradorAuthenticated from "../../../../../middlewares/isAdministradorAuthenticated";
import isCuentaTemporalAuthenticated from "../../../../../middlewares/isCuentaTemporalAuthenticated";
import checkAuthentication from "../../../../../middlewares/checkAuthentication";
import {
  EmpleoActualDetalle,
  HistorialLaboralPaginado,
  PersonaDatosFormulario,
  ResponseDetallePersonaData,
  ResponseSuccessGetDetallePersona,
  SeccionDetallePersona,
} from "../../../../../interfaces/shared/apis/api01/personas/[identificadorPersona]/types";
import { obtenerDetallePersonaPorId } from "../../../../../core/databases/queries/personas/obtenerDetallePersonaPorId";
import { ErrorResponseAPIBase } from "../../../../../interfaces/shared/apis/types";
import {
  DataConflictErrorTypes,
  FileErrorTypes,
  SystemErrorTypes,
  UserErrorTypes,
  ValidationErrorTypes,
} from "../../../../../interfaces/shared/errors";
import { r2StorageClient } from "../../../../../core/buckets/connectors/CloudfareR2";
import { obtenerHistorialLaboralPersona } from "../../../../../core/databases/queries/personas/obtenerHistorialLaboralPersona";
import { parsearDocumentoIdentidad } from "../../../../../lib/utils/formatters/documentosIdentidad";
import { ADMINISTRADORES_SESSION_EXPIRATION } from "../../../../../constants/EXPIRACIONES_JWT";
import { uploadFotoPersonaMiddleware } from "../../../../../middlewares/uploadFotoPersona";
import {
  verificarExistenciaEmpresa,
  insertarEmpleadoEmpresa,
} from "../../../../../core/databases/queries/personas/registrarPersona";
import {
  actualizarDatosPersona,
  actualizarDetallesEmpleoActivo,
  finalizarEmpleoActivo,
  obtenerEmpleoActivoPersona,
  verificarConflictosActualizacionPersona,
} from "../../../../../core/databases/queries/personas/actualizarPersona";

const personaPorIdentificadorRouter = Router();

// =======================================================================================
//                  DOCUMENTACIÓN SWAGGER / OPENAPI (GET /personas/:idPersona)
// =======================================================================================
/**
 * @openapi
 * /clientes/personas/{idPersona}:
 *   get:
 *     summary: Obtener información detallada y/o historial laboral de una persona
 *     description: >
 *       Retorna los datos de formulario de la persona (incluyendo fechas de registro y actualización,
 *       y su empleo activo actual si existe) y/o su historial laboral paginado con el enum EstadoDeEmpleo.
 *     tags:
 *       - Personas
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idPersona
 *         required: true
 *         schema:
 *           type: string
 *         description: "Identificador compuesto de la persona (ej. 10928374-1)."
 *         example: "10928374-1"
 *       - in: query
 *         name: incluir
 *         required: false
 *         schema:
 *           type: string
 *           enum: [detalles, historial, todos]
 *           default: todos
 *         description: "Sección(es) a retornar en la respuesta ('detalles', 'historial' o 'todos'). Predeterminado: todos."
 *       - in: query
 *         name: paginaHistorial
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: "Número de página para el historial laboral. Mínimo: 1. Predeterminado: 1."
 *         example: 1
 *       - in: query
 *         name: limiteHistorial
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 20
 *           default: 5
 *         description: "Cantidad de registros por página en el historial laboral. Mínimo: 1, máximo: 20. Predeterminado: 5."
 *         example: 5
 *     responses:
 *       200:
 *         description: Datos obtenidos exitosamente.
 *       400:
 *         description: Parámetros inválidos.
 *       401:
 *         description: No autorizado.
 *       404:
 *         description: Persona no encontrada.
 *       500:
 *         description: Error interno del servidor.
 */
personaPorIdentificadorRouter.get(
  "/:idPersona",
  isAdministradorAuthenticated,
  isCuentaTemporalAuthenticated,
  checkAuthentication,
  async (req: Request, res: Response) => {
    try {
      const paramsValidation = getDetallePersonaParamsSchema.safeParse(
        req.params,
      );
      const queryValidation = getDetallePersonaQuerySchema.safeParse(req.query);

      if (!paramsValidation.success || !queryValidation.success) {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: "Parámetros de solicitud o consulta inválidos",
          errorType: ValidationErrorTypes.INVALID_FORMAT,
        };
        return res.status(400).json(errorResponse);
      }

      const { idPersona } = paramsValidation.data;
      const { incluir, paginaHistorial, limiteHistorial } =
        queryValidation.data;

      const cargarDetalles =
        incluir === SeccionDetallePersona.TODOS ||
        incluir === SeccionDetallePersona.DETALLES;
      const cargarHistorial =
        incluir === SeccionDetallePersona.TODOS ||
        incluir === SeccionDetallePersona.HISTORIAL;

      const offsetHistorial = (paginaHistorial - 1) * limiteHistorial;

      const [personaDb, historialDb] = await Promise.all([
        cargarDetalles
          ? obtenerDetallePersonaPorId(idPersona)
          : Promise.resolve(null),
        cargarHistorial
          ? obtenerHistorialLaboralPersona(
              idPersona,
              limiteHistorial,
              offsetHistorial,
            )
          : Promise.resolve(null),
      ]);

      if (cargarDetalles && !personaDb) {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: "No se encontró a la persona solicitada",
          errorType: UserErrorTypes.USER_NOT_FOUND,
        };
        return res.status(404).json(errorResponse);
      }

      const responsePayload: ResponseDetallePersonaData = {};

      if (cargarDetalles && personaDb) {
        let fotoUrl: string | null = null;
        if (personaDb.Ruta_Foto) {
          try {
            fotoUrl = await r2StorageClient.getPresignedDownloadUrl(
              personaDb.Ruta_Foto,
              ADMINISTRADORES_SESSION_EXPIRATION + 300,
            );
          } catch {
            fotoUrl = null;
          }
        }

        const empleoActual: EmpleoActualDetalle | null = personaDb.Id_Empresa
          ? {
              Id_Empleado_Empresa: personaDb.Id_Empleado_Empresa!,
              Id_Empresa: personaDb.Id_Empresa,
              RUC: personaDb.RUC!,
              Razon_Social: personaDb.Razon_Social!,
              Cargo_Empleado: personaDb.Cargo_Empleado,
              Correo_Corporativo_Empleado:
                personaDb.Correo_Corporativo_Empleado,
              Fecha_Asignacion: personaDb.Fecha_Asignacion,
            }
          : null;

        const personaData: PersonaDatosFormulario = {
          Identificador_Persona: personaDb.Identificador_Persona,
          Documento: parsearDocumentoIdentidad(personaDb.Identificador_Persona),
          Nombres: personaDb.Nombres,
          Apellidos: personaDb.Apellidos,
          Celular: personaDb.Celular,
          Correo: personaDb.Correo,
          Foto_Perfil_URL: fotoUrl,
          Fecha_Registro: personaDb.Fecha_Registro,
          Fecha_Actualizacion: personaDb.Fecha_Actualizacion,
          Empleo_Actual: empleoActual,
        };

        responsePayload.Persona = personaData;
      }

      if (cargarHistorial && historialDb) {
        const historialData: HistorialLaboralPaginado = {
          Total_Registros: historialDb.totalRegistros,
          Pagina_Actual: paginaHistorial,
          Total_Paginas:
            Math.ceil(historialDb.totalRegistros / limiteHistorial) || 1,
          items: historialDb.items,
        };

        responsePayload.Historial_Laboral = historialData;
      }

      const response: ResponseSuccessGetDetallePersona = {
        success: true,
        message: "Detalles de la persona obtenidos exitosamente",
        data: responsePayload,
      };

      return res.status(200).json(response);
    } catch (error) {
      console.error("Error al obtener detalle de persona:", error);
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "Error interno al obtener los detalles de la persona",
        errorType: SystemErrorTypes.DATABASE_ERROR,
      };
      return res.status(500).json(errorResponse);
    }
  },
);

// =======================================================================================
//                  DOCUMENTACIÓN SWAGGER / OPENAPI (PUT /personas/:idPersona)
// =======================================================================================
/**
 * @openapi
 * /clientes/personas/{idPersona}:
 *   put:
 *     summary: Actualizar información de una persona y gestionar su vínculo laboral
 *     description: >
 *       Permite actualizar nombres, apellidos, celular, correo personal (único) y foto de perfil.
 *       Establece la marca de tiempo de auditoría `Fecha_Actualizacion` al timestamp ISO exacto de llegada al servidor.
 *       Si se cambia la empresa asignada, el empleo vigente anterior queda finalizado (con Fecha_Fin_Asignacion = hoy)
 *       y se crea un nuevo vínculo laboral. Si se envía idEmpresa en null o 0, pasa al estado Sin Empresa.
 *     tags:
 *       - Personas
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idPersona
 *         required: true
 *         schema:
 *           type: string
 *         description: "Identificador compuesto de la persona (ej. 71986445-1)."
 *         example: "71986445-1"
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - nombres
 *               - apellidos
 *             properties:
 *               nombres:
 *                 type: string
 *                 example: "Felipe Matías"
 *               apellidos:
 *                 type: string
 *                 example: "Soto Chávez"
 *               celular:
 *                 type: string
 *                 nullable: true
 *                 example: "+51987654321"
 *               correo:
 *                 type: string
 *                 nullable: true
 *                 example: "felipe.soto@ejemplo.com"
 *               idEmpresa:
 *                 type: integer
 *                 nullable: true
 *                 description: "ID de la empresa asignada. Omitir o enviar null/0 para dejar sin empresa."
 *                 example: 2
 *               cargoEmpleado:
 *                 type: string
 *                 nullable: true
 *                 example: "Supervisor de Seguridad"
 *               correoCorporativoEmpleado:
 *                 type: string
 *                 nullable: true
 *                 example: "fsoto@empresa.com"
 *               foto:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Persona actualizada exitosamente.
 *       400:
 *         description: Parámetros del formulario inválidos.
 *       404:
 *         description: La persona no existe.
 *       409:
 *         description: Conflicto - Correo personal ya registrado por otra persona o correo corporativo activo en uso.
 *       500:
 *         description: Error interno del servidor.
 */
personaPorIdentificadorRouter.put(
  "/:idPersona",
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
    // 0. Capturar el timestamp ISO exacto de llegada al servidor
    const timestampLlegadaServidorISO = new Date().toISOString();
    let rutaFotoSubida: string | null = null;

    try {
      // 1. Validar parámetros de ruta
      const paramsValidation = getDetallePersonaParamsSchema.safeParse(
        req.params,
      );
      if (!paramsValidation.success) {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: "Identificador de persona inválido",
          errorType: ValidationErrorTypes.INVALID_FORMAT,
        };
        return res.status(400).json(errorResponse);
      }

      const { idPersona } = paramsValidation.data;

      // 2. Validar cuerpo de la petición con Zod
      const parseResult = actualizarPersonaBodySchema.safeParse(req.body);
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
        nombres,
        apellidos,
        celular,
        correo,
        idEmpresa,
        cargoEmpleado,
        correoCorporativoEmpleado,
      } = parseResult.data;

      // 3. Verificar existencia de la persona y de su empleo actual activo
      const [personaActual, empleoActivoActual] = await Promise.all([
        obtenerDetallePersonaPorId(idPersona),
        obtenerEmpleoActivoPersona(idPersona),
      ]);

      if (!personaActual) {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: `No se encontró a la persona con identificador ${idPersona}`,
          errorType: UserErrorTypes.USER_NOT_FOUND,
        };
        return res.status(404).json(errorResponse);
      }

      // 4. Validar existencia de la empresa si se va a asociar una
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

      // 5. Validar unicidad de correo personal y corporativo (409 Conflict)
      const { existeCorreoPersonal, existeCorreoCorporativoActivo } =
        await verificarConflictosActualizacionPersona({
          idPersona,
          correoPersonal: correo,
          correoCorporativo: correoCorporativoEmpleado,
          idEmpleadoEmpresaActual:
            empleoActivoActual?.Id_Empleado_Empresa || null,
        });

      if (existeCorreoPersonal) {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: `El correo personal '${correo}' ya está en uso por otra persona`,
          errorType: DataConflictErrorTypes.VALUE_ALREADY_IN_USE,
          conflictField: "correo",
        };
        return res.status(409).json(errorResponse);
      }

      if (existeCorreoCorporativoActivo) {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: `El correo corporativo '${correoCorporativoEmpleado}' ya está asignado a otro empleo activo`,
          errorType: DataConflictErrorTypes.VALUE_ALREADY_IN_USE,
          conflictField: "correoCorporativoEmpleado",
        };
        return res.status(409).json(errorResponse);
      }

      // 6. Subir nueva foto a Cloudflare R2 si viene un archivo
      if (req.file) {
        const ext = path.extname(req.file.originalname).toLowerCase() || ".png";
        rutaFotoSubida = `Fotos_Perfil/Personas/${idPersona}${ext}`;

        await r2StorageClient.uploadFile(
          rutaFotoSubida,
          req.file.buffer,
          req.file.mimetype,
        );
      }

      // 7. Actualizar tabla T_Personas pasando el timestamp exacto del servidor
      const fechaActualizacionPersistida = await actualizarDatosPersona({
        idPersona,
        nombres,
        apellidos,
        celular,
        correo,
        rutaFoto: rutaFotoSubida !== null ? rutaFotoSubida : undefined,
        fechaActualizacion: timestampLlegadaServidorISO,
      });

      // 8. Aplicar Reglas de Negocio del Vínculo Laboral
      if (empleoActivoActual) {
        if (!idEmpresa) {
          // Pasa a "Sin Empresa": finalizar empleo actual
          await finalizarEmpleoActivo(empleoActivoActual.Id_Empleado_Empresa);
        } else if (empleoActivoActual.Id_Empresa !== idEmpresa) {
          // Cambia de empresa: finalizar anterior y crear nuevo
          await finalizarEmpleoActivo(empleoActivoActual.Id_Empleado_Empresa);
          await insertarEmpleadoEmpresa({
            idEmpresa,
            idPersona,
            cargo: cargoEmpleado,
            correoCorporativo: correoCorporativoEmpleado,
          });
        } else {
          // Misma empresa: actualizar cargo y correo corporativo
          await actualizarDetallesEmpleoActivo({
            idEmpleadoEmpresa: empleoActivoActual.Id_Empleado_Empresa,
            cargo: cargoEmpleado,
            correoCorporativo: correoCorporativoEmpleado,
          });
        }
      } else if (idEmpresa) {
        // No tenía empleo activo previo: asignar nuevo
        await insertarEmpleadoEmpresa({
          idEmpresa,
          idPersona,
          cargo: cargoEmpleado,
          correoCorporativo: correoCorporativoEmpleado,
        });
      }

      // 9. Resolver URL prefirmada actualizada
      const fotoFinalRuta = rutaFotoSubida || personaActual.Ruta_Foto;
      let fotoUrlActualizada: string | null = null;
      if (fotoFinalRuta) {
        try {
          fotoUrlActualizada = await r2StorageClient.getPresignedDownloadUrl(
            fotoFinalRuta,
            ADMINISTRADORES_SESSION_EXPIRATION + 300,
          );
        } catch {
          fotoUrlActualizada = null;
        }
      }

      return res.status(200).json({
        success: true,
        message: "Persona actualizada exitosamente",
        data: {
          Identificador_Persona: idPersona,
          Nombres: nombres,
          Apellidos: apellidos,
          Foto_Perfil_URL: fotoUrlActualizada,
          Fecha_Actualizacion: fechaActualizacionPersistida,
        },
      });
    } catch (error) {
      console.error("Error al actualizar persona:", error);
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "Error interno al actualizar la persona",
        errorType: SystemErrorTypes.DATABASE_ERROR,
      };
      return res.status(500).json(errorResponse);
    }
  },
);

export default personaPorIdentificadorRouter;
