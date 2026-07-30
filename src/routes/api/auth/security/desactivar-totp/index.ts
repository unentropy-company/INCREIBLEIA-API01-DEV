import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";

import { TiposUsuario } from "../../../../../interfaces/shared/TiposUsuario";
import {
  PermissionErrorTypes,
  RequestErrorTypes,
  SystemErrorTypes,
  UserErrorTypes,
} from "../../../../../interfaces/shared/errors";
import { AdministradorAuthenticated } from "../../../../../interfaces/shared/JWTPayload";
import { buscarAdministradorPorIdSelect } from "../../../../../core/databases/queries/administradores/buscarAdministradorPorId";
import { desactivarTotpAdministrador } from "../../../../../core/databases/queries/administradores/desactivarTotpAdministador";
import { desactivarTotpSchema } from "./schemas.zod";
import { ResponseSuccessDesactivarTotp } from "../../../../../interfaces/shared/apis/api01/auth/security/desactivar-totp/types";

const desactivarTotpRouter = Router();

/**
 * @openapi
 * /auth/security/desactivar-totp:
 *   post:
 *     summary: Desactivar la autenticación TOTP para un Administrador
 *     description: >
 *       Valida la contraseña actual del Administrador autenticado y remueve la
 *       configuración TOTP estableciendo sus campos correspondientes en NULL.
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
 *               - Contraseña
 *             properties:
 *               Contraseña:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 maxLength: 20
 *                 example: "MiPassword123!"
 *                 description: >
 *                   Contraseña actual del administrador para confirmar la operación.
 *                   Debe ser una cadena de texto entre 8 y 20 caracteres.
 *     responses:
 *       200:
 *         description: TOTP desactivado exitosamente.
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
 *                   example: "TOTP desactivado exitosamente"
 *       400:
 *         description: >
 *           Error de validación en la contraseña ingresada.
 *           Posibles códigos devueltos en 'message':
 *           - MISSING_PASSWORD: La contraseña es obligatoria.
 *           - PASSWORD_TOO_SHORT: La contraseña debe tener al menos 8 caracteres.
 *           - PASSWORD_TOO_LONG: La contraseña no puede superar los 20 caracteres.
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
 *                   enum: [MISSING_PASSWORD, PASSWORD_TOO_SHORT, PASSWORD_TOO_LONG]
 *                   example: "PASSWORD_TOO_SHORT"
 *                 errorType:
 *                   type: string
 *                   example: "INVALID_PARAMETERS"
 *       401:
 *         description: La contraseña ingresada no coincide con el registro del usuario.
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
 *                   example: "La contraseña ingresada es incorrecta."
 *                 errorType:
 *                   type: string
 *                   example: "INVALID_CREDENTIALS"
 *       403:
 *         description: El usuario no tiene rol de Administrador.
 *       404:
 *         description: El usuario no fue encontrado en la base de datos.
 *       500:
 *         description: Error interno de servidor o base de datos.
 */
desactivarTotpRouter.post("/", async (req: Request, res: Response) => {
  try {
    const userType = req.userType!;

    if (userType !== TiposUsuario.Administrador) {
      return res.status(403).json({
        success: false,
        message: "Acceso no permitido para este tipo de usuario.",
        errorType: PermissionErrorTypes.PERMISSION_DENIED,
      });
    }

    const parseResult = desactivarTotpSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstError =
        parseResult.error.issues[0]?.message || "INVALID_PARAMETERS";
      return res.status(400).json({
        success: false,
        message: firstError,
        errorType: RequestErrorTypes.INVALID_PARAMETERS,
      });
    }

    const { Contraseña } = parseResult.data;
    const adminUser = req.user! as AdministradorAuthenticated;

    const administrador = await buscarAdministradorPorIdSelect(
      adminUser.Id_Administrador,
      ["Contraseña"],
    );

    if (!administrador) {
      return res.status(404).json({
        success: false,
        message: "No se encontró el usuario administrador.",
        errorType: UserErrorTypes.USER_NOT_FOUND,
      });
    }

    const esPasswordValida = await bcrypt.compare(
      Contraseña,
      administrador.Contraseña,
    );

    if (!esPasswordValida) {
      return res.status(401).json({
        success: false,
        message: "La contraseña ingresada es incorrecta.",
        errorType: UserErrorTypes.INVALID_CREDENTIALS,
      });
    }

    await desactivarTotpAdministrador(adminUser.Id_Administrador);

    const response: ResponseSuccessDesactivarTotp = {
      success: true,
      message: "TOTP desactivado exitosamente",
    };

    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error interno al desactivar TOTP",
      errorType: SystemErrorTypes.DATABASE_ERROR,
    });
  }
});

export default desactivarTotpRouter;
