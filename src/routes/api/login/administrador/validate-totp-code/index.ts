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
