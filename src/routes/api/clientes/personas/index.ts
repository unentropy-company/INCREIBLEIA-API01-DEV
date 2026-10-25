import { Router, Request, Response } from "express";

import isAdministradorAuthenticated from "../../../../middlewares/isAdministradorAuthenticated";
import isCuentaTemporalAuthenticated from "../../../../middlewares/isCuentaTemporalAuthenticated";
import checkAuthentication from "../../../../middlewares/checkAuthentication";
import {
  getListadoPersonasQuerySchema,
  getUltimosRegistrosQuerySchema,
} from "./schemas.zod";
import { ErrorResponseAPIBase } from "../../../../interfaces/shared/apis/types";
import {
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
//                  DOCUMENTACIÓN SWAGGER / OPENAPI (GET /personas/ultimos-registros)
// =======================================================================================
/**
 * @openapi
 * /clientes/personas/ultimos-registros:
 *   get:
 *     summary: Obtener los últimos registros de personas para el widget lateral
 *     description: >
 *       Retorna los registros de personas más recientes limitados a una antigüedad de 0 a 10 días.
 *       Incluye únicamente el identificador desglosado, nombres, apellidos y empresa actual activa si la tiene.
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
 *         description: "Días máximos de antigüedad del registro (0 representa únicamente los del día de hoy). Mínimo: 0, máximo: 10. Predeterminado: 0."
 *         example: 0
 *       - in: query
 *         name: limite
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *           default: 5
 *         description: "Cantidad de registros recientes a retornar. Mínimo: 1, máximo: 5. Predeterminado: 5."
 *         example: 4
 *     responses:
 *       200:
 *         description: Últimos registros obtenidos exitosamente.
 *       400:
 *         description: Parámetro diasMaximos o limite con valor fuera de rango.
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
          message: "El parámetro diasMaximos debe ser un entero entre 0 y 10",
          errorType: ValidationErrorTypes.INVALID_FORMAT,
        };
        return res.status(400).json(errorResponse);
      }

      const { diasMaximos, limite } = queryValidation.data;
      const registros = await obtenerUltimosRegistrosPersonas(
        diasMaximos,
        limite,
      );

      const items: UltimoRegistroPersonaItem[] = registros.map((p) => ({
        Identificador_Persona: p.Identificador_Persona,
        Documento: parsearDocumentoIdentidad(p.Identificador_Persona),
        Nombres: p.Nombres,
        Apellidos: p.Apellidos,
        Empresa_Actual: p.Id_Empresa
          ? {
              Id_Empresa: p.Id_Empresa,
              Razon_Social: p.Razon_Social!,
            }
          : null,
      }));

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

personasRouter.use(detallePersonaRouter);

export default personasRouter;
