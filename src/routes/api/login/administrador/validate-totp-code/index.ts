import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

import { ValidateTotpInput, validateTotpSchema } from "./schemas.zod";
import { ErrorResponseAPIBase } from "../../../../../interfaces/shared/apis/types";
import {
  AuthenticationErrorTypes,
  RequestErrorTypes,
  SystemErrorTypes,
  TokenErrorTypes,
  UserErrorTypes,
  ValidationErrorTypes,
} from "../../../../../interfaces/shared/errors";
import { JWTPayloadForTotpOperationsInAuthenticationForAdministradores } from "../../../../../interfaces/shared/JWTPayload";
import { buscarAdministradorPorIdSelect } from "../../../../../core/databases/queries/administradores/buscarAdministradorPorId";
import { verifyTotpCode } from "./utils/verifyTotpCode";
import { generateAdministradorToken } from "../../../../../lib/helpers/functions/jwt/generators/administradorToken";
import { r2StorageClient } from "../../../../../core/buckets/connectors/CloudfareR2";
import { ADMINISTRADORES_SESSION_EXPIRATION } from "../../../../../constants/EXPIRACIONES_JWT";
import { ResponseSuccessLogin } from "../../../../../interfaces/shared/apis/api01/login/types";
import { TiposUsuario } from "../../../../../interfaces/shared/TiposUsuario";
import { Genero } from "../../../../../interfaces/shared/Genero";

const validateTotpCodeRouter = Router();

// =======================================================================================
//                          DOCUMENTACIÓN SWAGGER / OPENAPI
// =======================================================================================
/**
 * @openapi
 * /login/administrador/validar-codigo-totp:
 *   post:
 *     summary: Validación de segundo factor (TOTP) para inicio de sesión de Administrador
 *     description: >
 *       Verifica el Totp_Operation_Token (obtenido en la primera etapa del inicio de sesión)
 *       junto con el código numérico de 6 dígitos generado por la aplicación autenticadora del usuario.
 *
 *       Si la validación es exitosa, emite el token JWT definitivo de la sesión e incluye los
 *       datos del perfil junto con la URL firmada de la foto de perfil en R2 storage.
 *     tags:
 *       - Autenticación
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - Totp_Operation_Token
 *               - Totp_Code
 *             properties:
 *               Totp_Operation_Token:
 *                 type: string
 *                 description: >
 *                   Token JWT temporal de operación generado en la primera fase del login.
 *                   Tiene una vigencia máxima de 5.5 minutos (330 segundos).
 *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *               Totp_Code:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 6
 *                 pattern: '^[0-9]{6}$'
 *                 description: "Código TOTP de 6 dígitos numéricos generado por la app autenticadora."
 *                 example: "582910"
 *     responses:
 *       200:
 *         description: Autenticación completa exitosa. Retorna el token JWT de sesión definitivo.
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
 *                   example: "Inicio de sesión completado exitosamente"
 *                 data:
 *                   type: object
 *                   properties:
 *                     Nombre_Usuario:
 *                       type: string
 *                       example: "admin.user_01"
 *                     Tipo_Usuario:
 *                       type: string
 *                       enum: ["A", "CT"]
 *                       description: "A = Administrador, CT = Cuenta Temporal"
 *                       example: "A"
 *                     Nombres:
 *                       type: string
 *                       example: "Juan"
 *                     Apellidos:
 *                       type: string
 *                       example: "Pérez"
 *                     Genero:
 *                       type: string
 *                       enum: ["M", "F"]
 *                       description: "M = Masculino, F = Femenino"
 *                       example: "M"
 *                     Foto_Perfil_URL:
 *                       type: string
 *                       nullable: true
 *                       example: "https://r2.bucket.com/foto.jpg?token=..."
 *                     token:
 *                       type: string
 *                       description: "JWT de sesión de larga duración para solicitudes autorizadas."
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       400:
 *         description: Faltan parámetros obligatorios en la solicitud o el formato del código TOTP es inválido.
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
 *                   example: "El código TOTP debe ser una cadena exacta de 6 dígitos numéricos"
 *                 errorType:
 *                   type: string
 *                   example: "INVALID_FORMAT"
 *       401:
 *         description: >
 *           Fallos de autenticación:
 *           - TOKEN_EXPIRED: El token de operación de 5.5 minutos caducó.
 *           - TOKEN_INVALID_SIGNATURE: El token fue manipulado o alterado.
 *           - USER_NOT_FOUND: El usuario fue eliminado o no tiene TOTP activo.
 *           - OTP_INVALID: El código TOTP numérico ingresado es incorrecto o expiró.
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
 *                   example: "El código TOTP es incorrecto o ha expirado"
 *                 errorType:
 *                   type: string
 *                   example: "OTP_INVALID"
 *       500:
 *         description: Error interno en el servidor o variable de entorno no configurada.
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
 *                   example: "Error en el servidor, por favor intente más tarde"
 *                 errorType:
 *                   type: string
 *                   example: "UNKNOWN_ERROR"
 */

// ==========================================
//                CONTROLADOR
// ==========================================
validateTotpCodeRouter.post("/", (async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // 1. Validación del cuerpo con Zod
    const validation = validateTotpSchema.safeParse(req.body);

    if (!validation.success) {
      const issue = validation.error.issues[0];
      const messageCode = issue.message;

      if (
        messageCode === "MISSING_TOTP_OPERATION_TOKEN" ||
        messageCode === "MISSING_TOTP_CODE"
      ) {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: "El token de operación y el código TOTP son obligatorios",
          errorType: RequestErrorTypes.MISSING_PARAMETERS,
        };
        return res.status(400).json(errorResponse);
      }

      if (
        messageCode === "TOTP_CODE_INVALID_LENGTH" ||
        messageCode === "TOTP_CODE_INVALID_FORMAT"
      ) {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message:
            "El código TOTP debe ser una cadena exacta de 6 dígitos numéricos",
          errorType: ValidationErrorTypes.INVALID_FORMAT,
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

    const { Totp_Operation_Token, Totp_Code }: ValidateTotpInput =
      validation.data;

    // 2. Verificación del Token de Operación (Firma y Expiración)
    const secret = process.env.LOGIN_TOTP_OPERATION_SECRET;

    if (!secret) {
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "Error de configuración interna en el servidor",
        errorType: SystemErrorTypes.CONFIGURATION_ERROR,
      };
      return res.status(500).json(errorResponse);
    }

    let decoded: JWTPayloadForTotpOperationsInAuthenticationForAdministradores;

    try {
      decoded = jwt.verify(
        Totp_Operation_Token,
        secret,
      ) as JWTPayloadForTotpOperationsInAuthenticationForAdministradores;
    } catch (jwtError: any) {
      if (jwtError.name === "TokenExpiredError") {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message:
            "El token de operación ha expirado. Por favor, inicie sesión nuevamente.",
          errorType: TokenErrorTypes.TOKEN_EXPIRED,
        };
        return res.status(401).json(errorResponse);
      }

      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "Token de operación inválido o alterado",
        errorType: TokenErrorTypes.TOKEN_INVALID_SIGNATURE,
      };
      return res.status(401).json(errorResponse);
    }

    // 3. Obtener credenciales TOTP y datos del Administrador
    const administrador = await buscarAdministradorPorIdSelect(
      decoded.Id_Administrador,
      [
        "Id_Administrador",
        "Nombre_Usuario",
        "Nombres",
        "Apellidos",
        "Genero",
        "Ruta_Foto_Perfil",
        "Totp_Secret",
        "Duracion_Codigos_Totp_Segundos",
      ],
    );

    if (!administrador || !administrador.Totp_Secret) {
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "El usuario no fue encontrado o no posee TOTP activo",
        errorType: UserErrorTypes.USER_NOT_FOUND,
      };
      return res.status(401).json(errorResponse);
    }

    // 4. Validar el código TOTP numérico enviado
    const period = administrador.Duracion_Codigos_Totp_Segundos || 30;
    const isTotpValid = verifyTotpCode(
      Totp_Code,
      administrador.Totp_Secret,
      period,
    );

    if (!isTotpValid) {
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "El código TOTP es incorrecto o ha expirado",
        errorType: AuthenticationErrorTypes.OTP_INVALID,
      };
      return res.status(401).json(errorResponse);
    }

    // 5. Emisión del token de sesión definitivo y respuesta
    const sessionToken = generateAdministradorToken(
      administrador.Id_Administrador,
      administrador.Nombre_Usuario,
    );

    const url_presigned =
      administrador.Ruta_Foto_Perfil &&
      (await r2StorageClient.getPresignedDownloadUrl(
        administrador.Ruta_Foto_Perfil,
        ADMINISTRADORES_SESSION_EXPIRATION + 300,
      ));

    const response: ResponseSuccessLogin = {
      success: true,
      message: "Inicio de sesión completado exitosamente",
      data: {
        Nombre_Usuario: administrador.Nombre_Usuario,
        Tipo_Usuario: TiposUsuario.Administrador,
        Nombres: administrador.Nombres,
        Apellidos: administrador.Apellidos,
        Genero: administrador.Genero as Genero,
        Foto_Perfil_URL: url_presigned,
        token: sessionToken,
      },
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error en validación TOTP:", error);

    const errorResponse: ErrorResponseAPIBase = {
      success: false,
      message: "Error en el servidor, por favor intente más tarde",
      errorType: SystemErrorTypes.UNKNOWN_ERROR,
      details: { error: String(error) },
    };

    return res.status(500).json(errorResponse);
  }
}) as any);

export default validateTotpCodeRouter;
