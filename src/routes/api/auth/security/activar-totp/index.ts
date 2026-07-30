import { Router, Request, Response } from "express";
import speakeasy from "speakeasy";
import bcrypt from "bcrypt";

import { activarTotpSchema } from "./schemas.zod";
import { TOTP_DEFAULT_DURATION_SECONDS } from "../../../../../constants/TOTP_CONFIGURATION";
import { TiposUsuario } from "../../../../../interfaces/shared/TiposUsuario";
import {
  PermissionErrorTypes,
  RequestErrorTypes,
  SystemErrorTypes,
  UserErrorTypes,
} from "../../../../../interfaces/shared/errors";
import { AdministradorAuthenticated } from "../../../../../interfaces/shared/JWTPayload";
import { buscarAdministradorPorIdSelect } from "../../../../../core/databases/queries/administradores/buscarAdministradorPorId";
import { ResponseSuccessActivarTotp } from "../../../../../interfaces/shared/apis/api01/auth/security/activar-totp/types";
import { actualizarTotpAdministrador } from "../../../../../core/databases/queries/administradores/actualizarTotpAdministrador";

const activarTotpRouter = Router();

/**
 * @openapi
 * /auth/security/activar-totp:
 *   post:
 *     summary: Habilitar y confirmar autenticación TOTP
 *     description: >
 *       Verifica la contraseña actual del Administrador y valida el primer código TOTP
 *       generado por la aplicación autenticadora para guardar el secreto en la BD.
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
 *               - Totp_Code
 *             properties:
 *               Contraseña:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 maxLength: 20
 *                 example: "MiPassword123!"
 *                 description: >
 *                   Contraseña actual del administrador para reconfirmar identidad.
 *                   Requerida, de 8 a 20 caracteres.
 *               Totp_Code:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 6
 *                 pattern: '^[0-9]{6}$'
 *                 example: "482910"
 *                 description: "Código de 6 dígitos numéricos generado por la App autenticadora (Google Authenticator, Authy, etc.)."
 *     responses:
 *       200:
 *         description: TOTP activado exitosamente.
 *       400:
 *         description: Error de validación en los parámetros enviados (contraseña o código numérico).
 *       401:
 *         description: Contraseña o código TOTP inválidos.
 *       500:
 *         description: Error interno en el servidor.
 */
activarTotpRouter.post("/", async (req: Request, res: Response) => {
  try {
    const userType = req.userType!;

    if (userType !== TiposUsuario.Administrador) {
      return res.status(403).json({
        success: false,
        message: "Acceso no permitido para este tipo de usuario.",
        errorType: PermissionErrorTypes.PERMISSION_DENIED,
      });
    }

    const parseResult = activarTotpSchema.safeParse(req.body);
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
      ["Contraseña", "Correo", "Nombre_Usuario"],
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

    const secret = speakeasy.generateSecret({ length: 20 }).base32;
    const duracionSegundos = TOTP_DEFAULT_DURATION_SECONDS;

    await actualizarTotpAdministrador(adminUser.Id_Administrador, {
      Totp_Secret: secret,
      Duracion_Codigos_Totp_Segundos: duracionSegundos,
    });

    const issuer = encodeURIComponent("INCREIBLE IA");
    const label = encodeURIComponent(
      administrador.Correo || administrador.Nombre_Usuario,
    );

    const totpUrl = `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}&period=${duracionSegundos}`;

    const response: ResponseSuccessActivarTotp = {
      success: true,
      message: "TOTP activado exitosamente",
      Totp_Url: totpUrl,
    };

    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error interno al activar TOTP",
      errorType: SystemErrorTypes.DATABASE_ERROR,
    });
  }
});

export default activarTotpRouter;
