import { Router, Request, Response } from "express";
import isAdministradorAuthenticated from "../../../../middlewares/isAdministradorAuthenticated";
import isCuentaTemporalAuthenticated from "../../../../middlewares/isCuentaTemporalAuthenticated";
import checkAuthentication from "../../../../middlewares/checkAuthentication";
import { getSelectorEmpresasQuerySchema } from "./schemas.zod";
import { obtenerEmpresasParaSelector } from "../../../../core/databases/queries/empresas/obtenerEmpresasParaSelector";
import { SelectorEmpresasData } from "../../../../interfaces/shared/apis/api01/empresas/types";
import { ErrorResponseAPIBase } from "../../../../interfaces/shared/apis/types";
import {
  SystemErrorTypes,
  ValidationErrorTypes,
} from "../../../../interfaces/shared/errors";

const selectorEmpresasRouter = Router();

// =======================================================================================
//        DOCUMENTACIÓN SWAGGER / OPENAPI (GET /clientes/empresas/selector)
// =======================================================================================
/**
 * @openapi
 * /clientes/empresas/selector:
 *   get:
 *     summary: Obtener empresas paginadas para el selector modal
 *     description: >
 *       Retorna las empresas disponibles paginadas (límite configurable de 1 a 15)
 *       junto con la cantidad de empleados que laboran actualmente en cada una.
 *       Incluye el conteo total de personas que no cuentan con empresa asociada
 *       y los metadatos de paginación en convención Pascal_Snake_Case.
 *     tags:
 *       - Empresas
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         required: false
 *         schema:
 *           type: string
 *         description: Búsqueda flexible por RUC o Razón Social.
 *         example: "Minera"
 *       - in: query
 *         name: pagina
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Número de página.
 *         example: 1
 *       - in: query
 *         name: limite
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 15
 *           default: 10
 *         description: Cantidad máxima de registros a retornar por página (estricto entre 1 y 15).
 *         example: 10
 *     responses:
 *       200:
 *         description: Empresas obtenidas exitosamente.
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
 *                   example: "Empresas para selector obtenidas exitosamente"
 *                 data:
 *                   type: object
 *                   properties:
 *                     Total_Personas_Sin_Empresa:
 *                       type: integer
 *                       example: 80
 *                     Total_Resultados_Filtrados:
 *                       type: integer
 *                       example: 25
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
 *                           Id_Empresa:
 *                             type: integer
 *                             example: 4
 *                           RUC:
 *                             type: string
 *                             example: "20548812345"
 *                           Razon_Social:
 *                             type: string
 *                             example: "Minera Antares S.A.C."
 *                           Cantidad_Empleados_Actuales:
 *                             type: integer
 *                             example: 21
 *       400:
 *         description: Parámetros de consulta no válidos (por ejemplo limite > 15 o pagina < 1).
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
 *                   example: "Parámetros de consulta no válidos"
 *                 errorType:
 *                   type: string
 *                   example: "INVALID_FORMAT"
 *       401:
 *         description: No autorizado - Token JWT ausente o inválido.
 *       500:
 *         description: Error interno al consultar la base de datos.
 */
selectorEmpresasRouter.get(
  "/selector",
  isAdministradorAuthenticated,
  isCuentaTemporalAuthenticated,
  checkAuthentication,
  async (req: Request, res: Response) => {
    try {
      const validation = getSelectorEmpresasQuerySchema.safeParse(req.query);

      if (!validation.success) {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: "Parámetros de consulta no válidos",
          errorType: ValidationErrorTypes.INVALID_FORMAT,
        };
        return res.status(400).json(errorResponse);
      }

      const { search, pagina, limite } = validation.data;
      const offset = (pagina - 1) * limite;

      const { totalPersonasSinEmpresa, totalFiltrados, empresas } =
        await obtenerEmpresasParaSelector(search, limite, offset);

      const responsePayload: SelectorEmpresasData = {
        Total_Personas_Sin_Empresa: totalPersonasSinEmpresa,
        Total_Resultados_Filtrados: totalFiltrados,
        Pagina_Actual: pagina,
        Total_Paginas: Math.ceil(totalFiltrados / limite) || 1,
        items: empresas,
      };

      return res.status(200).json({
        success: true,
        message: "Empresas para selector obtenidas exitosamente",
        data: responsePayload,
      });
    } catch (error) {
      console.error("Error al obtener selector de empresas:", error);
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "Error interno al obtener las empresas para el selector",
        errorType: SystemErrorTypes.DATABASE_ERROR,
      };
      return res.status(500).json(errorResponse);
    }
  },
);

export default selectorEmpresasRouter;
