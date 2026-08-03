import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";

import {
  DataErrorTypes,
  RequestErrorTypes,
  SystemErrorTypes,
  UserErrorTypes,
} from "../../../../interfaces/shared/errors";
import { ErrorResponseAPIBase } from "../../../../interfaces/shared/apis/types";
import { TiposUsuario } from "../../../../interfaces/shared/TiposUsuario";
import { actualizarContrasenaSchema } from "./schemas.zod";
import {
  RequestBodyactualizarContraseña,
  ResponseSuccessActualizarContraseña,
} from "../../../../interfaces/shared/apis/api01/auth/contraseña/type";
import {
  actualizarContraseñaAdministrador,
  obtenerContraseñaAdministrador,
} from "../../../../core/databases/queries/administradores/obtencionActualizacionContraseñaAdministrador";
import {
  actualizarContraseñaCuentaTemporal,
  obtenerContraseñaCuentaTemporal,
} from "../../../../core/databases/queries/cuentas-temporales/obtencionActualizacionContraseñaCuentasTemporales";

const actualizarContrasenaRouter = Router();

// ==========================================
//               CONTROLADOR
// ==========================================

/**
 * @openapi
 * /auth/contraseña:
 *   put:
 *     summary: Actualizar contraseña del usuario
 *     description: Permite a un Administrador o Cuenta Temporal cambiar su contraseña previa verificación de la contraseña actual.
 *     tags:
 *       - Autenticación / TOTP
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - Contraseña_Actual
 *               - Nueva_Contraseña
 *             properties:
 *               Contraseña_Actual:
 *                 type: string
 *                 example: "MiClaveVieja123!"
 *               Nueva_Contraseña:
 *                 type: string
 *                 example: "MiClaveNueva456!"
 *     responses:
 *       200:
 *         description: Contraseña actualizada correctamente.
 *       400:
 *         description: Parámetros inválidos o la contraseña actual no coincide.
 *       401:
 *         description: Usuario no encontrado o sin sesión válida.
 *       500:
 *         description: Error interno del servidor o de base de datos.
 */
actualizarContrasenaRouter.put("/", (async (req: Request, res: Response) => {
  try {
    // 1. Extraer usuario autenticado de la sesión
    const authUser =
      (req.user as any)?.user || (req.user as any)?.data || req.user;
    const userType = req.userType!;

    // 2. Validar payload con Zod
    const validation = actualizarContrasenaSchema.safeParse(req.body);

    if (!validation.success) {
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "Los parámetros enviados en la solicitud son inválidos",
        errorType: RequestErrorTypes.INVALID_PARAMETERS,
        details: validation.error.flatten().fieldErrors,
      };
      return res.status(400).json(errorResponse);
    }

    const {
      Contraseña_Actual,
      Nueva_Contraseña,
    }: RequestBodyactualizarContraseña = validation.data;

    let passwordHashBd: string | null = null;
    let userId: number | null = null;

    // 3. Obtener credenciales actuales según el rol
    if (userType === TiposUsuario.Administrador) {
      userId = authUser?.Id_Administrador;
      if (!userId) {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: "No se pudo identificar al administrador en la sesión",
          errorType: UserErrorTypes.USER_NOT_FOUND,
        };
        return res.status(401).json(errorResponse);
      }

      passwordHashBd = await obtenerContraseñaAdministrador(userId);
    } else {
      userId = authUser?.Id_Cuenta_Temporal;
      if (!userId) {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: "No se pudo identificar la cuenta temporal en la sesión",
          errorType: UserErrorTypes.USER_NOT_FOUND,
        };
        return res.status(401).json(errorResponse);
      }

      passwordHashBd = await obtenerContraseñaCuentaTemporal(userId);
    }

    if (!passwordHashBd) {
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "El usuario no existe en el sistema",
        errorType: UserErrorTypes.USER_NOT_FOUND,
      };
      return res.status(404).json(errorResponse);
    }

    // 4. Verificar la contraseña actual contra la BD
    const isMatch = await bcrypt.compare(Contraseña_Actual, passwordHashBd);
    if (!isMatch) {
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "La contraseña actual ingresada es incorrecta",
        errorType: UserErrorTypes.INVALID_CREDENTIALS,
      };
      return res.status(400).json(errorResponse);
    }

    // 5. Generar hash de la nueva contraseña
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(Nueva_Contraseña, saltRounds);

    // 6. Actualizar en la base de datos de manera atómica
    let isUpdated = false;

    if (userType === TiposUsuario.Administrador) {
      isUpdated = await actualizarContraseñaAdministrador(
        userId,
        newPasswordHash,
      );
    } else {
      isUpdated = await actualizarContraseñaCuentaTemporal(
        userId,
        newPasswordHash,
      );
    }

    if (!isUpdated) {
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "No se pudo actualizar la contraseña del usuario",
        errorType: DataErrorTypes.DATA_INCONSISTENT,
      };
      return res.status(500).json(errorResponse);
    }

    // 7. Respuesta exitosa usando el tipo exacto solicitado
    const successResponse: ResponseSuccessActualizarContraseña = {
      success: true,
      message: "La contraseña se actualizó correctamente",
    };

    return res.status(200).json(successResponse);
  } catch (error: any) {
    console.error("Error al actualizar la contraseña:", error);

    const errorResponse: ErrorResponseAPIBase = {
      success: false,
      message: "Error interno en el servidor al actualizar la contraseña",
      errorType: SystemErrorTypes.DATABASE_ERROR,
      details: { error: String(error) },
    };

    return res.status(500).json(errorResponse);
  }
}) as any);

export default actualizarContrasenaRouter;
