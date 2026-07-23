import { NextFunction, Request, Response, Router } from "express";
import { z } from "zod";
import {
  ResponseSuccessLogin,
} from "../../../../interfaces/shared/apis/shared/login/types";
import { ErrorResponseAPIBase } from "../../../../interfaces/shared/apis/types";
import {
  RequestErrorTypes,
  SystemErrorTypes,
  UserErrorTypes,
  ValidationErrorTypes,
} from "../../../../interfaces/shared/errors";
import { buscarCuentaTemporalPorNombreUsuarioSelect } from "../../../../core/databases/queries/cuentas-temporales/buscarCuentaTemporalPorNombreUsuario";
import { verifyPassword } from "../../../../lib/helpers/encriptations/passwords.encriptation";
import { generateCuentaTemporalToken } from "../../../../lib/helpers/functions/jwt/generators/cuentaTemporalToken";
import { TiposUsuario } from "../../../../interfaces/shared/TiposUsuario";
import { r2StorageClient } from "../../../../core/buckets/connectors/CloudfareR2";
import { CUENTAS_TEMPORALES_SESSION_EXPIRATION } from "../../../../constants/EXPIRACIONES_JWT";
import { Genero } from "../../../../interfaces/shared/Genero";
import { loginCuentaTemporalSchema } from "./schemas.zod";

const loginCuentaTemporalRouter = Router();

export type LoginCuentaTemporalInput = z.infer<
  typeof loginCuentaTemporalSchema
>;

// =======================================================================================
//                             DOCUMENTACIÓN SWAGGER / OPENAPI                            
// =======================================================================================
/**
 * @openapi
 * /login/cuenta-temporal:
 *   post:
 *     summary: Inicio de sesión para cuentas temporales
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
 *                 example: "temp.user_01"
 *                 description: "De 8 a 20 caracteres. Solo minúsculas, números, puntos y '_'. No puede iniciar con número."
 *               Contraseña:
 *                 type: string
 *                 minLength: 8
 *                 maxLength: 20
 *                 example: "TempPass123!"
 *                 description: "De 8 a 20 caracteres."
 *     responses:
 *       200:
 *         description: Login exitoso.
 *       400:
 *         description: Parámetros faltantes o formato/longitud inválidos.
 *       401:
 *         description: Credenciales inválidas.
 *       403:
 *         description: Cuenta no habilitada aún o expirada.
 *       500:
 *         description: Error interno del servidor.
 */

// ==========================================
//                 CONTROLADOR                
// ==========================================
loginCuentaTemporalRouter.post("/", (async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // A. Validar con Zod
    const validation = loginCuentaTemporalSchema.safeParse(req.body);

    if (!validation.success) {
      const issue = validation.error.issues[0];
      const messageCode = issue.message;

      // Faltan campos obligatorios
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

      // Nombre de usuario fuera de reglas
      if (messageCode === "USERNAME_INVALID") {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message:
            "El nombre de usuario debe tener entre 8 y 20 caracteres, iniciar con letra minúscula o '_', y contener solo minúsculas, números, puntos o '_'.",
          errorType: ValidationErrorTypes.INVALID_USERNAME,
        };
        return res.status(400).json(errorResponse);
      }

      // Contraseña demasiado corta
      if (messageCode === "PASSWORD_TOO_SHORT") {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: "La contraseña debe tener al menos 8 caracteres",
          errorType: ValidationErrorTypes.INVALID_FORMAT,
        };
        return res.status(400).json(errorResponse);
      }

      // Contraseña excede el límite
      if (messageCode === "PASSWORD_TOO_LONG") {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: "La contraseña no puede superar los 20 caracteres",
          errorType: ValidationErrorTypes.STRING_TOO_LONG,
        };
        return res.status(400).json(errorResponse);
      }

      // Fallback
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "Error de validación en la solicitud",
        errorType: ValidationErrorTypes.INVALID_FORMAT,
      };
      return res.status(400).json(errorResponse);
    }

    // Extraer datos validados
    const { Nombre_Usuario, Contraseña }: LoginCuentaTemporalInput =
      validation.data;

    // B. Buscar la cuenta temporal en BD
    const cuentaTemporal = await buscarCuentaTemporalPorNombreUsuarioSelect(
      Nombre_Usuario,
      [
        "Id_Cuenta_Temporal",
        "Nombre_Usuario_Temporal",
        "Contraseña_Usuario_Temporal",
        "Nombres_Persona",
        "Apellidos_Persona",
        "Genero",
        "Ruta_Foto_Perfil",
        "Fecha_Hora_Inicio",
        "Fecha_Hora_Final",
      ],
    );

    if (!cuentaTemporal) {
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "Credenciales inválidas",
        errorType: UserErrorTypes.INVALID_CREDENTIALS,
      };
      return res.status(401).json(errorResponse);
    }

    // C. Verificar la ventana de vigencia
    const ahora = new Date();

    if (ahora < new Date(cuentaTemporal.Fecha_Hora_Inicio)) {
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "Esta cuenta temporal aún no está habilitada",
        errorType: UserErrorTypes.USER_INACTIVE,
      };
      return res.status(403).json(errorResponse);
    }

    if (ahora >= new Date(cuentaTemporal.Fecha_Hora_Final)) {
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "Esta cuenta temporal ha expirado",
        errorType: UserErrorTypes.USER_INACTIVE,
      };
      return res.status(403).json(errorResponse);
    }

    // D. Verificar la contraseña
    const isContraseñaValid = await verifyPassword(
      Contraseña,
      cuentaTemporal.Contraseña_Usuario_Temporal,
    );

    if (!isContraseñaValid) {
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "Credenciales inválidas",
        errorType: UserErrorTypes.INVALID_CREDENTIALS,
      };
      return res.status(401).json(errorResponse);
    }

    // E. Generar token JWT
    const token = generateCuentaTemporalToken(
      cuentaTemporal.Id_Cuenta_Temporal,
      cuentaTemporal.Nombre_Usuario_Temporal,
    );

    // F. Obtener URL prefirmada para R2 si existe
    const url_presigned =
      cuentaTemporal.Ruta_Foto_Perfil &&
      (await r2StorageClient.getPresignedDownloadUrl(
        cuentaTemporal.Ruta_Foto_Perfil,
        CUENTAS_TEMPORALES_SESSION_EXPIRATION + 300,
      ));

    // G. Respuesta exitosa
    const response: ResponseSuccessLogin = {
      success: true,
      message: "Inicio de sesión exitoso",
      data: {
        Nombre_Usuario: cuentaTemporal.Nombre_Usuario_Temporal,
        Tipo_Usuario: TiposUsuario.Cuenta_Temporal,
        Nombres: cuentaTemporal.Nombres_Persona,
        Apellidos: cuentaTemporal.Apellidos_Persona,
        Genero: cuentaTemporal.Genero as Genero,
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

export default loginCuentaTemporalRouter;