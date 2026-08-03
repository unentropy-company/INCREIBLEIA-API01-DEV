import { Router, Request, Response } from "express";

import {
  DataConflictErrorTypes,
  RequestErrorTypes,
  SystemErrorTypes,
  UserErrorTypes,
} from "../../../../interfaces/shared/errors";
import { ErrorResponseAPIBase } from "../../../../interfaces/shared/apis/types";
import { TiposUsuario } from "../../../../interfaces/shared/TiposUsuario";
import { actualizarNombreUsuarioAdministrador } from "../../../../core/databases/queries/administradores/actualizarNombreUsuarioAdministrador";
import { actualizarNombreUsuarioCuentaTemporal } from "../../../../core/databases/queries/cuentas-temporales/actualizarNombreUsuarioCuentaTemporal";
import { actualizarNombreUsuarioSchema } from "./schemas.zod";

const actualizarNombreUsuarioRouter = Router();

// ==========================================
//               CONTROLADOR
// ==========================================

/**
 * @openapi
 * /mi-perfil/nombre-usuario:
 *   put:
 *     summary: Actualizar nombre de usuario(Solo Administradores)
 *     description: Permite actualizar el nombre de usuario único de un Administrador o Cuenta Temporal.
 *     tags:
 *       - Mi Perfil
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - Nombre_Usuario
 *             properties:
 *               Nombre_Usuario:
 *                 type: string
 *                 example: "admin_dev"
 *     responses:
 *       200:
 *         description: Nombre de usuario actualizado correctamente.
 *       400:
 *         description: Error de validación Zod en los parámetros enviados.
 *       401:
 *         description: Usuario o sesión no encontrada.
 *       404:
 *         description: Usuario no encontrado en la base de datos.
 *       409:
 *         description: Conflicto, el nombre de usuario ya está en uso.
 *       500:
 *         description: Error interno en el servidor o base de datos.
 */
actualizarNombreUsuarioRouter.put("/", (async (req: Request, res: Response) => {
  try {
    // 1. Extraer usuario autenticado de forma segura
    const authUser =
      (req.user as any)?.user || (req.user as any)?.data || req.user;
    const userType = req.userType!;

    // 2. Validar Body con Zod
    const validation = actualizarNombreUsuarioSchema.safeParse(req.body);

    if (!validation.success) {
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "Los parámetros enviados en la solicitud son inválidos",
        errorType: RequestErrorTypes.INVALID_PARAMETERS,
        details: validation.error.flatten().fieldErrors,
      };
      return res.status(400).json(errorResponse);
    }

    const { Nombre_Usuario } = validation.data;
    let isUpdatedInDb = false;

    // 3. Ejecutar consulta atómica según el tipo de usuario
    if (userType === TiposUsuario.Administrador) {
      const idAdmin = authUser?.Id_Administrador;

      if (!idAdmin) {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: "No se pudo encontrar el usuario especificado",
          errorType: UserErrorTypes.USER_NOT_FOUND,
        };
        return res.status(401).json(errorResponse);
      }

      isUpdatedInDb = await actualizarNombreUsuarioAdministrador(
        idAdmin,
        Nombre_Usuario,
      );
    } else {
      const idCuentaTemp = authUser?.Id_Cuenta_Temporal;

      if (!idCuentaTemp) {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: "No se pudo encontrar el usuario especificado",
          errorType: UserErrorTypes.USER_NOT_FOUND,
        };
        return res.status(401).json(errorResponse);
      }

      isUpdatedInDb = await actualizarNombreUsuarioCuentaTemporal(
        idCuentaTemp,
        Nombre_Usuario,
      );
    }

    if (!isUpdatedInDb) {
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "No se encontró el registro del usuario para actualizar",
        errorType: UserErrorTypes.USER_NOT_FOUND,
      };
      return res.status(404).json(errorResponse);
    }

    return res.status(200).json({
      success: true,
      message: "Nombre de usuario actualizado exitosamente",
      data: {
        Nombre_Usuario,
      },
    });
  } catch (error: any) {
    console.error("Error al actualizar el nombre de usuario:", error);

    // Captura de error de duplicidad/unicidad en PostgreSQL (Código 23505) o Prisma (P2002)
    if (
      error?.code === "23505" ||
      error?.code === "P2002" ||
      error?.message?.includes("UNIQUE")
    ) {
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "El nombre de usuario especificado ya se encuentra en uso",
        errorType: DataConflictErrorTypes.VALUE_ALREADY_IN_USE,
      };
      return res.status(409).json(errorResponse);
    }

    const errorResponse: ErrorResponseAPIBase = {
      success: false,
      message: "Error de conexión o ejecución en la base de datos",
      errorType: SystemErrorTypes.DATABASE_ERROR,
      details: { error: String(error) },
    };

    return res.status(500).json(errorResponse);
  }
}) as any);

export default actualizarNombreUsuarioRouter;
