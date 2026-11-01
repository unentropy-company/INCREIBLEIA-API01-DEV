import { Router, Request, Response, NextFunction } from "express";
import path from "path";
import multer from "multer";

import {
  getDetallePersonaParamsSchema,
  getDetallePersonaQuerySchema,
  actualizarPersonaBodySchema,
  actualizarEmpleoPersonaBodySchema,
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
  obtenerDetalleEmpleoPorId,
  obtenerEmpleoActivoPersona,
  verificarConflictosActualizacionPersona,
} from "../../../../../core/databases/queries/personas/actualizarPersona";
import { verificarEliminabilidadPersonaQuery } from "../../../../../core/databases/queries/personas/verificarEliminabilidadPersona";
import { eliminarPersonaCascadaQuery } from "../../../../../core/databases/queries/personas/eliminarPersona";

const detallePersonaRouter = Router();

// =======================================================================================
//                  DOCUMENTACIÓN SWAGGER / OPENAPI (GET /personas/:idPersona)
// =======================================================================================
/**
 * @openapi
 * /personas/{idPersona}:
 *   get:
 *     summary: Obtener información detallada y/o historial laboral de una persona
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
 *       - in: query
 *         name: incluir
 *         required: false
 *         schema:
 *           type: string
 *           enum: [detalles, historial, todos]
 *           default: todos
 *       - in: query
 *         name: paginaHistorial
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limiteHistorial
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 20
 *           default: 5
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
detallePersonaRouter.get(
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
 * /personas/{idPersona}:
 *   put:
 *     summary: Actualizar información de una persona y gestionar su vínculo laboral
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
 *               apellidos:
 *                 type: string
 *               celular:
 *                 type: string
 *                 nullable: true
 *               correo:
 *                 type: string
 *                 nullable: true
 *               idEmpresa:
 *                 type: integer
 *                 nullable: true
 *               cargoEmpleado:
 *                 type: string
 *                 nullable: true
 *               correoCorporativoEmpleado:
 *                 type: string
 *                 nullable: true
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
 *         description: Conflicto en correos.
 *       500:
 *         description: Error interno del servidor.
 */
detallePersonaRouter.put(
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
    const timestampLlegadaServidorISO = new Date().toISOString();
    let rutaFotoSubida: string | null = null;

    try {
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

      if (req.file) {
        const ext = path.extname(req.file.originalname).toLowerCase() || ".png";
        rutaFotoSubida = `Fotos_Perfil/Personas/${idPersona}${ext}`;

        await r2StorageClient.uploadFile(
          rutaFotoSubida,
          req.file.buffer,
          req.file.mimetype,
        );
      }

      const fechaActualizacionPersistida = await actualizarDatosPersona({
        idPersona,
        nombres,
        apellidos,
        celular,
        correo,
        rutaFoto: rutaFotoSubida !== null ? rutaFotoSubida : undefined,
        fechaActualizacion: timestampLlegadaServidorISO,
      });

      if (empleoActivoActual) {
        if (!idEmpresa) {
          await finalizarEmpleoActivo(empleoActivoActual.Id_Empleado_Empresa);
        } else if (empleoActivoActual.Id_Empresa !== idEmpresa) {
          await finalizarEmpleoActivo(empleoActivoActual.Id_Empleado_Empresa);
          await insertarEmpleadoEmpresa({
            idEmpresa,
            idPersona,
            cargo: cargoEmpleado,
            correoCorporativo: correoCorporativoEmpleado,
          });
        } else {
          await actualizarDetallesEmpleoActivo({
            idEmpleadoEmpresa: empleoActivoActual.Id_Empleado_Empresa,
            cargo: cargoEmpleado,
            correoCorporativo: correoCorporativoEmpleado,
          });
        }
      } else if (idEmpresa) {
        await insertarEmpleadoEmpresa({
          idEmpresa,
          idPersona,
          cargo: cargoEmpleado,
          correoCorporativo: correoCorporativoEmpleado,
        });
      }

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

// =======================================================================================
//        DOCUMENTACIÓN SWAGGER / OPENAPI (PATCH /personas/:idPersona/actualizar-empleo)
// =======================================================================================
/**
 * @openapi
 * /personas/{idPersona}/actualizar-empleo:
 *   patch:
 *     summary: Actualizar exclusivamente el empleo y vínculo laboral de una persona
 *     description: >
 *       Permite modificar únicamente la situación laboral de una persona sin alterar sus datos personales ni foto:
 *       * **Cerrar empleo:** Enviar `idEmpresa: null` o `0` finaliza el empleo vigente (`Fecha_Fin_Asignacion = CURRENT_DATE`).
 *       * **Cambiar empresa:** Si el `idEmpresa` es diferente, finaliza el empleo activo actual e inserta un nuevo registro.
 *       * **Actualizar cargo/correo:** Si el `idEmpresa` es el mismo, actualiza el cargo y correo corporativo sin cerrar el vínculo.
 *       * **Nuevo empleo:** Si no tenía empresa activa y se envía una, se crea el nuevo registro.
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
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               idEmpresa:
 *                 type: integer
 *                 nullable: true
 *                 description: "ID de la empresa asignada (mínimo: 1). Enviar null o 0 para finalizar empleo actual."
 *                 example: 2
 *               cargoEmpleado:
 *                 type: string
 *                 nullable: true
 *                 example: "Coordinador de Calidad"
 *               correoCorporativoEmpleado:
 *                 type: string
 *                 nullable: true
 *                 example: "felipe.soto@empresa2.com"
 *     responses:
 *       200:
 *         description: Vínculo laboral actualizado exitosamente.
 *       400:
 *         description: Datos de solicitud o identificador inválidos.
 *       404:
 *         description: Persona no encontrada.
 *       409:
 *         description: Conflicto - La empresa no existe o el correo corporativo ya está en uso por otro empleado activo.
 *       500:
 *         description: Error interno del servidor.
 */
detallePersonaRouter.patch(
  "/:idPersona/actualizar-empleo",
  isAdministradorAuthenticated,
  isCuentaTemporalAuthenticated,
  checkAuthentication,
  async (req: Request, res: Response) => {
    try {
      // 1. Validar parámetro de ruta
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

      // 2. Validar cuerpo JSON con Zod
      const parseResult = actualizarEmpleoPersonaBodySchema.safeParse(req.body);
      if (!parseResult.success) {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: "Parámetros del empleo inválidos",
          errorType: ValidationErrorTypes.INVALID_FORMAT,
          errors: parseResult.error.flatten().fieldErrors,
        };
        return res.status(400).json(errorResponse);
      }

      const { idEmpresa, cargoEmpleado, correoCorporativoEmpleado } =
        parseResult.data;

      // 3. Verificar existencia de persona y su empleo activo
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

      // 4. Si se especifica empresa, verificar que exista en BD
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

      // 5. Verificar conflicto de correo corporativo
      if (correoCorporativoEmpleado) {
        const { existeCorreoCorporativoActivo } =
          await verificarConflictosActualizacionPersona({
            idPersona,
            correoPersonal: null,
            correoCorporativo: correoCorporativoEmpleado,
            idEmpleadoEmpresaActual:
              empleoActivoActual?.Id_Empleado_Empresa || null,
          });

        if (existeCorreoCorporativoActivo) {
          const errorResponse: ErrorResponseAPIBase = {
            success: false,
            message: `El correo corporativo '${correoCorporativoEmpleado}' ya está asignado a otro empleo activo`,
            errorType: DataConflictErrorTypes.VALUE_ALREADY_IN_USE,
            conflictField: "correoCorporativoEmpleado",
          };
          return res.status(409).json(errorResponse);
        }
      }

      // 6. Aplicar la lógica de negocio laboral
      let idEmpleadoEmpresaFinal: number | null = null;

      if (empleoActivoActual) {
        if (!idEmpresa) {
          // Caso A: Pasar a "Sin Empresa" (cerrar actual)
          await finalizarEmpleoActivo(empleoActivoActual.Id_Empleado_Empresa);
        } else if (empleoActivoActual.Id_Empresa !== idEmpresa) {
          // Caso B: Cambio de empresa (cerrar anterior y crear nuevo)
          await finalizarEmpleoActivo(empleoActivoActual.Id_Empleado_Empresa);
          const nuevo = await insertarEmpleadoEmpresa({
            idEmpresa,
            idPersona,
            cargo: cargoEmpleado,
            correoCorporativo: correoCorporativoEmpleado,
          });
          idEmpleadoEmpresaFinal = nuevo.Id_Empleado_Empresa;
        } else {
          // Caso C: Misma empresa (actualizar cargo y correo corporativo)
          await actualizarDetallesEmpleoActivo({
            idEmpleadoEmpresa: empleoActivoActual.Id_Empleado_Empresa,
            cargo: cargoEmpleado,
            correoCorporativo: correoCorporativoEmpleado,
          });
          idEmpleadoEmpresaFinal = empleoActivoActual.Id_Empleado_Empresa;
        }
      } else if (idEmpresa) {
        // Caso D: No tenía empleo vigente y se asigna uno nuevo
        const nuevo = await insertarEmpleadoEmpresa({
          idEmpresa,
          idPersona,
          cargo: cargoEmpleado,
          correoCorporativo: correoCorporativoEmpleado,
        });
        idEmpleadoEmpresaFinal = nuevo.Id_Empleado_Empresa;
      }

      // 7. Consultar entidad completa para garantizar RUC, Razón Social y fechas
      let empleoCompleto = null;
      if (idEmpleadoEmpresaFinal) {
        empleoCompleto = await obtenerDetalleEmpleoPorId(
          idEmpleadoEmpresaFinal,
        );
      }

      return res.status(200).json({
        success: true,
        message: "Vínculo laboral actualizado exitosamente",
        data: {
          Identificador_Persona: idPersona,
          Empleo_Actual: empleoCompleto
            ? {
                Id_Empleado_Empresa: empleoCompleto.Id_Empleado_Empresa,
                Id_Empresa: empleoCompleto.Id_Empresa,
                RUC: empleoCompleto.RUC || null,
                Razon_Social: empleoCompleto.Razon_Social || null,
                Cargo_Empleado: empleoCompleto.Cargo_Empleado,
                Correo_Corporativo_Empleado:
                  empleoCompleto.Correo_Corporativo_Empleado,
                Fecha_Asignacion: empleoCompleto.Fecha_Asignacion,
              }
            : null,
        },
      });
    } catch (error) {
      console.error("Error al actualizar empleo de persona:", error);
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "Error interno al actualizar el vínculo laboral de la persona",
        errorType: SystemErrorTypes.DATABASE_ERROR,
      };
      return res.status(500).json(errorResponse);
    }
  },
);

// =======================================================================================
//   DOCUMENTACIÓN SWAGGER / OPENAPI (GET /personas/:idPersona/is-deletable)
// =======================================================================================
/**
 * @openapi
 * /personas/{idPersona}/is-deletable:
 *   get:
 *     summary: Verificar si una persona es eliminable y obtener estadísticas de integridad
 *     description: >
 *       Comprueba si la persona cuenta con certificados emitidos, historial laboral
 *       o capacitaciones activas/finalizadas para determinar si puede eliminarse sin violar
 *       la trazabilidad legal del sistema. Devuelve además los datos de identidad (tipo y número de documento)
 *       para presentar la confirmación amigable en el modal.
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
 *         description: "Identificador compuesto de la persona en el sistema (ej. 71986445-1)."
 *         example: "71986445-1"
 *     responses:
 *       200:
 *         description: Comprobación realizada exitosamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Verificación de eliminabilidad realizada exitosamente"
 *                 data:
 *                   type: object
 *                   properties:
 *                     Identificador_Persona:
 *                       type: string
 *                       description: "Identificador compuesto interno del sistema."
 *                       example: "71986445-1"
 *                     Nombre_Completo:
 *                       type: string
 *                       description: "Nombres y apellidos completos de la persona."
 *                       example: "Felipe Matías Soto Chávez"
 *                     Tipo_Documento_Nombre:
 *                       type: string
 *                       description: "Nombre descriptivo del documento de identidad."
 *                       example: "DNI"
 *                     Numero_Documento:
 *                       type: string
 *                       description: "Número real del documento con el que interactúa el usuario."
 *                       example: "71986445"
 *                     Certificados_Emitidos:
 *                       type: integer
 *                       description: "Total de certificados emitidos a nombre de la persona."
 *                       example: 0
 *                     Capacitaciones_Asociadas:
 *                       type: integer
 *                       description: "Total de capacitaciones donde ha estado registrada."
 *                       example: 0
 *                     Empleos_En_Historial:
 *                       type: integer
 *                       description: "Total de registros de empleo en su historial."
 *                       example: 0
 *                     Es_Eliminable:
 *                       type: boolean
 *                       description: "Indica si la persona puede ser eliminada definitivamente."
 *                       example: true
 *                     Motivo_No_Eliminable:
 *                       type: string
 *                       nullable: true
 *                       description: "Detalle explicativo cuando Es_Eliminable es false."
 *                       example: null
 *       400:
 *         description: Identificador de persona con formato inválido.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Identificador de persona inválido"
 *                 errorType:
 *                   type: string
 *                   example: "INVALID_FORMAT"
 *       404:
 *         description: La persona no existe en el sistema.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "No se encontró a la persona con identificador 71986445-1"
 *                 errorType:
 *                   type: string
 *                   example: "USER_NOT_FOUND"
 *       500:
 *         description: Error interno del servidor al procesar la verificación.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Error interno al verificar eliminabilidad de la persona"
 *                 errorType:
 *                   type: string
 *                   example: "DATABASE_ERROR"
 */
detallePersonaRouter.get(
  "/:idPersona/is-deletable",
  isAdministradorAuthenticated,
  isCuentaTemporalAuthenticated,
  checkAuthentication,
  async (req: Request, res: Response) => {
    try {
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

      const metricas = await verificarEliminabilidadPersonaQuery(idPersona);

      if (!metricas) {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: `No se encontró a la persona con identificador ${idPersona}`,
          errorType: UserErrorTypes.USER_NOT_FOUND,
        };
        return res.status(404).json(errorResponse);
      }

      const tieneCertificados = metricas.Certificados_Emitidos > 0;
      const tieneCapacitacionesConcluidas =
        metricas.Capacitaciones_Iniciadas_O_Finalizadas > 0;
      const tieneCapacitacionesPendientes =
        metricas.Capacitaciones_Pendientes > 0;

      let esEliminable = true;
      let motivoNoEliminable: string | null = null;

      // Escenario A: Bloqueo estricto e irrevocable por trazabilidad y auditoría
      if (tieneCertificados || tieneCapacitacionesConcluidas) {
        esEliminable = false;
        motivoNoEliminable =
          "No se puede eliminar: La persona cuenta con certificados emitidos o capacitaciones concluidas/en curso. Por motivos de auditoría y trazabilidad legal, este registro no puede ser eliminado.";
      }
      // Escenario B: Bloqueo temporal subsanable (desvinculando de clases pendientes)
      else if (tieneCapacitacionesPendientes) {
        esEliminable = false;
        motivoNoEliminable =
          "No se puede eliminar: La persona está inscrita en capacitaciones pendientes. Debe desvincularla de dichas clases antes de proceder con la eliminación.";
      }

      return res.status(200).json({
        success: true,
        message: "Verificación de eliminabilidad realizada exitosamente",
        data: {
          Identificador_Persona: idPersona,
          Nombre_Completo: `${metricas.Nombres} ${metricas.Apellidos}`.trim(),
          Tipo_Documento_Nombre: metricas.Tipo_Documento_Nombre,
          Numero_Documento: metricas.Numero_Documento,
          Certificados_Emitidos: metricas.Certificados_Emitidos,
          Capacitaciones_Asociadas: metricas.Capacitaciones_Asociadas,
          Empleos_En_Historial: metricas.Empleos_En_Historial,
          Es_Eliminable: esEliminable,
          Motivo_No_Eliminable: motivoNoEliminable,
        },
      });
    } catch (error) {
      console.error("Error al verificar eliminabilidad de persona:", error);
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "Error interno al verificar eliminabilidad de la persona",
        errorType: SystemErrorTypes.DATABASE_ERROR,
      };
      return res.status(500).json(errorResponse);
    }
  },
);

// =======================================================================================
//        DOCUMENTACIÓN SWAGGER / OPENAPI (DELETE /personas/:idPersona)
// =======================================================================================
/**
 * @openapi
 * /personas/{idPersona}:
 *   delete:
 *     summary: Eliminar definitivamente una persona del sistema
 *     description: >
 *       Valida previamente la eliminabilidad de la persona. Si no cuenta con certificados
 *       ni capacitaciones activas o concluidas:
 *       1. Elimina en cascada todos sus registros de empleo en T_Empleados_Empresas.
 *       2. Elimina la fila principal en T_Personas.
 *       3. Elimina el archivo de foto de perfil almacenado en Cloudflare R2 si existe.
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
 *     responses:
 *       200:
 *         description: Persona eliminada exitosamente.
 *       400:
 *         description: Identificador de persona con formato inválido.
 *       404:
 *         description: Persona no encontrada.
 *       409:
 *         description: Conflicto - La persona no es eliminable por tener certificados o capacitaciones asociadas.
 *       500:
 *         description: Error interno del servidor.
 */
detallePersonaRouter.delete(
  "/:idPersona",
  isAdministradorAuthenticated,
  isCuentaTemporalAuthenticated,
  checkAuthentication,
  async (req: Request, res: Response) => {
    try {
      // 1. Validar parámetro de ruta
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

      // 2. Verificar eliminabilidad e integridad referencial
      const metricas = await verificarEliminabilidadPersonaQuery(idPersona);

      if (!metricas) {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: `No se encontró a la persona con identificador ${idPersona}`,
          errorType: UserErrorTypes.USER_NOT_FOUND,
        };
        return res.status(404).json(errorResponse);
      }

      const tieneCertificados = metricas.Certificados_Emitidos > 0;
      const tieneCapacitacionesConcluidas =
        metricas.Capacitaciones_Iniciadas_O_Finalizadas > 0;
      const tieneCapacitacionesPendientes =
        metricas.Capacitaciones_Pendientes > 0;

      // Si no es eliminable, rechazamos con 409
      if (tieneCertificados || tieneCapacitacionesConcluidas) {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message:
            "No se puede eliminar: La persona cuenta con certificados emitidos o capacitaciones concluidas/en curso. Por motivos de auditoría y trazabilidad legal, este registro no puede ser eliminado.",
          errorType: DataConflictErrorTypes.DATABASE_CONSTRAINT,
        };
        return res.status(409).json(errorResponse);
      }

      if (tieneCapacitacionesPendientes) {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message:
            "No se puede eliminar: La persona está inscrita en capacitaciones pendientes. Debe desvincularla de dichas clases antes de proceder con la eliminación.",
          errorType: DataConflictErrorTypes.DATABASE_CONSTRAINT,
        };
        return res.status(409).json(errorResponse);
      }

      // 3. Ejecutar eliminación en cascada en la base de datos
      const resultadoEliminacion = await eliminarPersonaCascadaQuery(idPersona);

      if (!resultadoEliminacion) {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: `No se encontró a la persona con identificador ${idPersona}`,
          errorType: UserErrorTypes.USER_NOT_FOUND,
        };
        return res.status(404).json(errorResponse);
      }

      // 4. Limpieza del archivo físico en Cloudflare R2
      if (resultadoEliminacion.rutaFoto) {
        try {
          await r2StorageClient.deleteFile(resultadoEliminacion.rutaFoto);
        } catch (r2Error) {
          console.error(
            `[R2 Warning] No se pudo borrar la foto ${resultadoEliminacion.rutaFoto}:`,
            r2Error,
          );
        }
      }

      return res.status(200).json({
        success: true,
        message: "Persona eliminada exitosamente del sistema",
        data: {
          Identificador_Persona: idPersona,
          Nombre_Completo: `${metricas.Nombres} ${metricas.Apellidos}`.trim(),
        },
      });
    } catch (error) {
      console.error("Error al eliminar persona:", error);
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "Error interno al procesar la eliminación de la persona",
        errorType: SystemErrorTypes.DATABASE_ERROR,
      };
      return res.status(500).json(errorResponse);
    }
  },
);

export default detallePersonaRouter;
