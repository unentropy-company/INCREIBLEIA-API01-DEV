import { Router, Request, Response, NextFunction } from "express";
import {
  SystemErrorTypes,
  UserErrorTypes,
  ValidationErrorTypes,
  RequestErrorTypes,
} from "../../../../interfaces/shared/errors";
import { ErrorResponseAPIBase } from "../../../../interfaces/shared/apis/types";
import {
  ResponseSuccessLogin,
  ResponseSuccessLoginWithTotp,
} from "../../../../interfaces/shared/apis/api01/login/types";
import { buscarAdministradorPorNombreUsuarioSelect } from "../../../../core/databases/queries/administradores/buscarAdministradorPorNombreUsuario";
import { verifyPassword } from "../../../../lib/helpers/encriptations/passwords.encriptation";
import { generateAdministradorToken } from "../../../../lib/helpers/functions/jwt/generators/administradorToken";
import { TiposUsuario } from "../../../../interfaces/shared/TiposUsuario";
import { r2StorageClient } from "../../../../core/buckets/connectors/CloudfareR2";
import { Genero } from "../../../../interfaces/shared/Genero";
import { ADMINISTRADORES_SESSION_EXPIRATION } from "../../../../constants/EXPIRACIONES_JWT";
import { LoginAdminInput, loginAdminSchema } from "./schemas.zod";
import { generateTotpOperationToken } from "../../../../lib/helpers/functions/jwt/generators/totpOperationToken";
import validateTotpCodeRouter from "./validate-totp-code";

const loginAdministradorRouter = Router();

// =======================================================================================
//                          DOCUMENTACIÓN SWAGGER / OPENAPI
// =======================================================================================
/**
 * @openapi
 * /login/administrador:
 *   post:
 *     summary: Inicio de sesión para administradores (1er Factor)
 *     description: >
 *       Autentica el primer factor (Nombre_Usuario y Contraseña).
 *
 *       - **Si el administrador NO tiene TOTP habilitado**: Retorna el token de sesión definitivo,
 *         datos de perfil y la URL firmada de su foto de perfil.
 *       - **Si el administrador TIENE TOTP habilitado**: Retorna un `Totp_Operation_Token` firmado
 *         con expiración estricta de 5 minutos y medio (330s) para ser consumido en el endpoint de validación 2FA.
 *     tags:
 *       - Autenticación
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - Nombre_Usuario
 *               - Contraseña
 *             properties:
 *               Nombre_Usuario:
 *                 type: string
 *                 minLength: 8
 *                 maxLength: 20
 *                 pattern: '^[a-z_][a-z0-9_.]*$'
 *                 example: "admin.user_01"
 *                 description: "De 8 a 20 caracteres. Solo minúsculas, números, puntos y '_'. No inicia con número."
 *               Contraseña:
 *                 type: string
 *                 minLength: 8
 *                 maxLength: 20
 *                 example: "Password123!"
 *                 description: "Contraseña de acceso (8 a 20 caracteres)."
 *     responses:
 *       200:
 *         description: Responde dinámicamente según el estado de la autenticación de dos factores (TOTP).
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   title: Autenticación Completa (Sin 2FA)
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: true
 *                     message:
 *                       type: string
 *                       example: "Inicio de sesión exitoso"
 *                     data:
 *                       type: object
 *                       properties:
 *                         Nombre_Usuario:
 *                           type: string
 *                           example: "admin.user_01"
 *                         Tipo_Usuario:
 *                           type: string
 *                           example: "Administrador"
 *                         Nombres:
 *                           type: string
 *                           example: "Juan"
 *                         Apellidos:
 *                           type: string
 *                           example: "Pérez"
 *                         Genero:
 *                           type: string
 *                           example: "MASCULINO"
 *                         Foto_Perfil_URL:
 *                           type: string
 *                           nullable: true
 *                           example: "https://r2.bucket.com/foto.jpg?token=..."
 *                         token:
 *                           type: string
 *                           description: "JWT de sesión de larga duración para peticiones autorizadas."
 *                           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 - type: object
 *                   title: Requerida Verificación 2FA (TOTP Activo)
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: true
 *                     message:
 *                       type: string
 *                       example: "Se requiere verificación TOTP para completar el inicio de sesión"
 *                     data:
 *                       type: object
 *                       properties:
 *                         Totp_Operation_Token:
 *                           type: string
 *                           description: "JWT transaccional temporal de un solo uso con 5.5 minutos de validez."
 *                           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       400:
 *         description: Error de validación en parámetros obligatorios, formato o longitud.
 *       401:
 *         description: Credenciales incorrectas (Usuario o contraseña inválidos).
 *       500:
 *         description: Error interno de servidor.
 */

// ==========================================
//                CONTROLADOR
// ==========================================
loginAdministradorRouter.post("/", (async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // 1. Validar cuerpo con Zod
    const validation = loginAdminSchema.safeParse(req.body);

    if (!validation.success) {
      const issue = validation.error.issues[0];
      const messageCode = issue.message;

      if (
        messageCode === "MISSING_USERNAME" ||
        messageCode === "MISSING_PASSWORD"
      ) {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: "El nombre de usuario y la contraseña son obligatorios",
          errorType: RequestErrorTypes.MISSING_PARAMETERS,
        };
        return res.status(400).json(errorResponse);
      }

      if (messageCode === "USERNAME_INVALID") {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message:
            "El nombre de usuario debe tener entre 8 y 20 caracteres, iniciar con letra minúscula o '_', y contener solo minúsculas, números, puntos o '_'.",
          errorType: ValidationErrorTypes.INVALID_USERNAME,
        };
        return res.status(400).json(errorResponse);
      }

      if (messageCode === "PASSWORD_TOO_SHORT") {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: "La contraseña debe tener al menos 8 caracteres",
          errorType: ValidationErrorTypes.INVALID_FORMAT,
        };
        return res.status(400).json(errorResponse);
      }

      if (messageCode === "PASSWORD_TOO_LONG") {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: "La contraseña no puede superar los 20 caracteres",
          errorType: ValidationErrorTypes.STRING_TOO_LONG,
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

    const { Nombre_Usuario, Contraseña }: LoginAdminInput = validation.data;

    // 2. Buscar datos del administrador y sus credenciales TOTP
    const administrador = await buscarAdministradorPorNombreUsuarioSelect(
      Nombre_Usuario,
      [
        "Id_Administrador",
        "Nombre_Usuario",
        "Contraseña",
        "Nombres",
        "Apellidos",
        "Genero",
        "Ruta_Foto_Perfil",
        "Totp_Secret",
        "Duracion_Codigos_Totp_Segundos",
      ],
    );

    if (!administrador) {
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "Credenciales inválidas",
        errorType: UserErrorTypes.INVALID_CREDENTIALS,
      };
      return res.status(401).json(errorResponse);
    }

    // 3. Verificar hash de contraseña
    const isContraseñaValid = await verifyPassword(
      Contraseña,
      administrador.Contraseña,
    );

    if (!isContraseñaValid) {
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "Credenciales inválidas",
        errorType: UserErrorTypes.INVALID_CREDENTIALS,
      };
      return res.status(401).json(errorResponse);
    }

    // 4. Evaluar activación de 2FA
    const hasTotpEnabled =
      administrador.Totp_Secret !== null &&
      administrador.Duracion_Codigos_Totp_Segundos !== null;

    if (hasTotpEnabled) {
      // Generar Token de Operación firmado con LOGIN_TOTP_OPERATION_SECRET (Expira en 5.5 min)
      const totpOperationToken = generateTotpOperationToken(
        administrador.Id_Administrador,
        administrador.Nombre_Usuario,
      );

      const response: ResponseSuccessLoginWithTotp = {
        success: true,
        message:
          "Se requiere verificación TOTP para completar el inicio de sesión",
        data: {
          Totp_Operation_Token: totpOperationToken,
        },
      };

      return res.status(200).json(response);
    }

    // 5. Flujo Directo: Sin TOTP activado
    const token = generateAdministradorToken(
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
      message: "Inicio de sesión exitoso",
      data: {
        Nombre_Usuario: administrador.Nombre_Usuario,
        Tipo_Usuario: TiposUsuario.Administrador,
        Nombres: administrador.Nombres,
        Apellidos: administrador.Apellidos,
        Genero: administrador.Genero as Genero,
        Foto_Perfil_URL: url_presigned,
        token,
      },
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error en inicio de sesión:", error);

    const errorResponse: ErrorResponseAPIBase = {
      success: false,
      message: "Error en el servidor, por favor intente más tarde",
      errorType: SystemErrorTypes.UNKNOWN_ERROR,
      details: { error: String(error) },
    };

    return res.status(500).json(errorResponse);
  }
}) as any);

loginAdministradorRouter.use("/validar-codigo-totp", validateTotpCodeRouter)

export default loginAdministradorRouter;
