import { Router, Request, Response } from "express";

import {
  getDetallePersonaParamsSchema,
  getDetallePersonaQuerySchema,
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
  SystemErrorTypes,
  UserErrorTypes,
  ValidationErrorTypes,
} from "../../../../../interfaces/shared/errors";
import { r2StorageClient } from "../../../../../core/buckets/connectors/CloudfareR2";
import { obtenerHistorialLaboralPersona } from "../../../../../core/databases/queries/personas/obtenerHistorialLaboralPersona";
import { parsearDocumentoIdentidad } from "../../../../../lib/utils/formatters/documentosIdentidad";
import { ADMINISTRADORES_SESSION_EXPIRATION } from "../../../../../constants/EXPIRACIONES_JWT";

const detallePersonaRouter = Router();

// =======================================================================================
//                  DOCUMENTACIÓN SWAGGER / OPENAPI (GET /personas/:idPersona)
// =======================================================================================
/**
 * @openapi
 * /personas/{idPersona}:
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

export default detallePersonaRouter;
