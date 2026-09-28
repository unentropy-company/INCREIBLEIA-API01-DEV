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
 *         description: Búsqueda flexible por nombres, apellidos o identificador.
 *       - in: query
 *         name: idEmpresa
 *         required: false
 *         schema:
 *           type: integer
 *         description: Filtra por el identificador de la empresa activa actual asignada.
 *       - in: query
 *         name: tipoDocumento
 *         required: false
 *         schema:
 *           type: integer
 *           enum: [1, 2, 3]
 *         description: 1 = DNI, 2 = Carnet de Extranjería / CE, 3 = Pasaporte.
 *       - in: query
 *         name: tieneCertificados
 *         required: false
 *         schema:
 *           type: boolean
 *         description: true = con certificados, false = sin certificados, omitir = ambos.
 *       - in: query
 *         name: pagina
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Número de página.
 *       - in: query
 *         name: limite
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 6
 *         description: Cantidad de registros por página.
 *     responses:
 *       200:
 *         description: Listado obtenido exitosamente.
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
 *                   example: "Listado de personas obtenido exitosamente"
 *                 data:
 *                   type: object
 *                   properties:
 *                     Indicadores:
 *                       type: object
 *                       properties:
 *                         Total_Personas:
 *                           type: integer
 *                           example: 18
 *                         Total_Personas_Sin_Empresa:
 *                           type: integer
 *                           example: 11
 *                     Total_Resultados_Filtrados:
 *                       type: integer
 *                       example: 14
 *                     Pagina_Actual:
 *                       type: integer
 *                       example: 1
 *                     Total_Paginas:
 *                       type: integer
 *                       example: 3
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           Identificador_Persona:
 *                             type: string
 *                             example: "71986445-1"
 *                           Documento:
 *                             type: object
 *                             properties:
 *                               Identificador_Completo:
 *                                 type: string
 *                                 example: "71986445-1"
 *                               Numero_Documento:
 *                                 type: string
 *                                 example: "71986445"
 *                               Tipo_Documento_Id:
 *                                 type: integer
 *                                 example: 1
 *                               Tipo_Documento_Nombre:
 *                                 type: string
 *                                 example: "DNI"
 *                           Nombres:
 *                             type: string
 *                             example: "Felipe Matías"
 *                           Apellidos:
 *                             type: string
 *                             example: "Soto Chávez"
 *                           Foto_Perfil_URL:
 *                             type: string
 *                             nullable: true
 *                             example: null
 *                           Empresa_Actual:
 *                             type: object
 *                             nullable: true
 *                             properties:
 *                               Id_Empresa:
 *                                 type: integer
 *                                 example: 1
 *                               Razon_Social:
 *                                 type: string
 *                                 example: "MINERA LOS ANDES S.A.C."
 *                           Certificados:
 *                             type: object
 *                             properties:
 *                               Vigentes:
 *                                 type: integer
 *                                 example: 0
 *                               Vencidos:
 *                                 type: integer
 *                                 example: 0
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
 *         description: Días máximos de antigüedad (0 = hoy).
 *         example: 0
 *       - in: query
 *         name: limite
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 20
 *           default: 5
 *         description: Límite de registros.
 *         example: 4
 *     responses:
 *       200:
 *         description: Últimos registros obtenidos exitosamente.
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
 *                   example: "Últimos registros obtenidos exitosamente"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       Identificador_Persona:
 *                         type: string
 *                         example: "98364442-1"
 *                       Documento:
 *                         type: object
 *                         properties:
 *                           Identificador_Completo:
 *                             type: string
 *                             example: "98364442-1"
 *                           Numero_Documento:
 *                             type: string
 *                             example: "98364442"
 *                           Tipo_Documento_Id:
 *                             type: integer
 *                             example: 1
 *                           Tipo_Documento_Nombre:
 *                             type: string
 *                             example: "DNI"
 *                       Nombres:
 *                         type: string
 *                         example: "Roberto"
 *                       Apellidos:
 *                         type: string
 *                         example: "Sanchez Carlo"
 *                       Empresa_Actual:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           Id_Empresa:
 *                             type: integer
 *                             example: 5
 *                           Razon_Social:
 *                             type: string
 *                             example: "Agroind. del Sur"
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

export default personasRouter;
