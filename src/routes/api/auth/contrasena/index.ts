import { Router, Request, Response } from "express";

import {
  RequestErrorTypes,
  SystemErrorTypes,
  UserErrorTypes,
  ValidationErrorTypes,
  DataConflictErrorTypes,
  DataErrorTypes,
} from "../../../../interfaces/shared/errors";
import { ErrorResponseAPIBase } from "../../../../interfaces/shared/apis/types";
import { TiposUsuario } from "../../../../interfaces/shared/TiposUsuario";
import {
  AdministradorAuthenticated,
  CuentaTemporalAuthenticated,
  UserAuthenticatedAPI01,
} from "../../../../interfaces/shared/JWTPayload";
import {
  RequestBodyactualizarContraseña,
  ResponseSuccessActualizarContraseña,
} from "../../../../interfaces/shared/apis/api01/auth/contraseña/type";

import {
  verifyPassword,
  encryptPassword,
} from "../../../../lib/helpers/encriptations/passwords.encriptation";

import {
  obtenerContraseñaAdministrador,
  actualizarContraseñaAdministrador,
} from "../../../../core/databases/queries/administradores/obtencionActualizacionContraseñaAdministrador";
import {
  obtenerContraseñaCuentaTemporal,
  actualizarContraseñaCuentaTemporal,
} from "../../../../core/databases/queries/cuentas-temporales/obtencionActualizacionContraseñaCuentasTemporales";

import { actualizarContrasenaSchema } from "./schemas.zod";

const actualizarContrasenaRouter = Router();

// =======================================================================================
//                          DOCUMENTACIÓN SWAGGER / OPENAPI
// =======================================================================================
/**
 * @openapi
 * /auth/contraseña:
 *   put:
 *     summary: Actualizar la contraseña del usuario autenticado
 *     description: >
 *       Permite a un usuario autenticado (Administrador o Cuenta Temporal) cambiar su
 *       contraseña de acceso. Requiere verificar la contraseña actual antes de aplicar
 *       el cambio. La nueva contraseña no puede ser igual a la actual.
 *     tags:
 *       - Autenticación
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
 *                 minLength: 8
 *                 maxLength: 20
 *                 description: "Contraseña actual del usuario (8 a 20 caracteres)."
 *                 example: "Password123!"
 *               Nueva_Contraseña:
 *                 type: string
 *                 minLength: 8
 *                 maxLength: 20
 *                 description: "Nueva contraseña deseada (8 a 20 caracteres). Debe ser distinta a la actual."
 *                 example: "NuevaPassword456!"
 *     responses:
 *       200:
 *         description: Contraseña actualizada exitosamente.
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
 *                   example: "La contraseña se actualizó correctamente"
 *       400:
 *         description: Parámetros ausentes, formato/longitud inválidos, o la nueva contraseña es igual a la actual.
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
 *                   example: "La nueva contraseña no puede ser igual a la actual"
 *                 errorType:
 *                   type: string
 *                   example: "VALUE_ALREADY_IN_USE"
 *       401:
 *         description: No autorizado - Token ausente/inválido, o la contraseña actual es incorrecta.
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
 *                   example: "La contraseña actual ingresada es incorrecta"
 *                 errorType:
 *                   type: string
 *                   example: "INVALID_CREDENTIALS"
 *       404:
 *         description: Usuario no encontrado en la base de datos.
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
 *                   example: "El usuario no existe en el sistema"
 *                 errorType:
 *                   type: string
 *                   example: "USER_NOT_FOUND"
 *       500:
 *         description: Error interno del servidor al actualizar la contraseña.
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
 *                   example: "No se pudo actualizar la contraseña del usuario"
 *                 errorType:
 *                   type: string
 *                   example: "DATA_INCONSISTENT"
 */

// ==========================================
//                CONTROLADOR
// ==========================================
actualizarContrasenaRouter.put("/", (async (req: Request, res: Response) => {
  try {
    // 1. Validación de Body con Zod
    const validation = actualizarContrasenaSchema.safeParse(req.body);

    if (!validation.success) {
      const issue = validation.error.issues[0];
      const messageCode = issue.message;

      if (
        messageCode === "MISSING_CURRENT_PASSWORD" ||
        messageCode === "MISSING_NEW_PASSWORD"
      ) {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message:
            "La contraseña actual y la nueva contraseña son obligatorias",
          errorType: RequestErrorTypes.MISSING_PARAMETERS,
        };
        return res.status(400).json(errorResponse);
      }

      if (messageCode === "CURRENT_PASSWORD_INVALID_LENGTH") {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: "La contraseña actual debe tener entre 8 y 20 caracteres",
          errorType: ValidationErrorTypes.INVALID_FORMAT,
        };
        return res.status(400).json(errorResponse);
      }

      if (messageCode === "NEW_PASSWORD_TOO_SHORT") {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: "La nueva contraseña debe tener al menos 8 caracteres",
          errorType: ValidationErrorTypes.INVALID_FORMAT,
        };
        return res.status(400).json(errorResponse);
      }

      if (messageCode === "NEW_PASSWORD_TOO_LONG") {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: "La nueva contraseña no puede superar los 20 caracteres",
          errorType: ValidationErrorTypes.STRING_TOO_LONG,
        };
        return res.status(400).json(errorResponse);
      }

      if (messageCode === "NEW_PASSWORD_SAME_AS_CURRENT") {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: "La nueva contraseña no puede ser igual a la actual",
          errorType: DataConflictErrorTypes.VALUE_ALREADY_IN_USE,
        };
        return res.status(400).json(errorResponse);
      }

      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "Error de validación en la solicitud",
        errorType: ValidationErrorTypes.INVALID_FORMAT,
      };
      return res.status(400).json(errorResponse);
    }

    const {
      Contraseña_Actual,
      Nueva_Contraseña,
    }: RequestBodyactualizarContraseña = validation.data;

    // 2. Determinar rol del usuario autenticado (poblado por los middlewares de auth)
    const userType = req.userType!;
    const esAdministrador = userType === TiposUsuario.Administrador;

    const user = req.user! as UserAuthenticatedAPI01;

    let userId: number;
    let passwordHashBd: string | null;

    if (esAdministrador) {
      userId = (user as AdministradorAuthenticated).Id_Administrador;
      passwordHashBd = await obtenerContraseñaAdministrador(userId);
    } else {
      userId = (user as CuentaTemporalAuthenticated).Id_Cuenta_Temporal;
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

    // 3. Verificar contraseña actual contra la BD
    const isContraseñaActualValid = await verifyPassword(
      Contraseña_Actual,
      passwordHashBd,
    );

    if (!isContraseñaActualValid) {
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "La contraseña actual ingresada es incorrecta",
        errorType: UserErrorTypes.INVALID_CREDENTIALS,
      };
      return res.status(401).json(errorResponse);
    }

    // 4. Hashear la nueva contraseña
    const nuevaContraseñaHasheada = await encryptPassword(Nueva_Contraseña);

    // 5. Actualizar en la base de datos de forma atómica según el rol
    const isUpdated = esAdministrador
      ? await actualizarContraseñaAdministrador(userId, nuevaContraseñaHasheada)
      : await actualizarContraseñaCuentaTemporal(
          userId,
          nuevaContraseñaHasheada,
        );

    if (!isUpdated) {
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "No se pudo actualizar la contraseña del usuario",
        errorType: DataErrorTypes.DATA_INCONSISTENT,
      };
      return res.status(500).json(errorResponse);
    }

    // 6. Respuesta exitosa
    const successResponse: ResponseSuccessActualizarContraseña = {
      success: true,
      message: "La contraseña se actualizó correctamente",
    };

    return res.status(200).json(successResponse);
  } catch (error) {
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
