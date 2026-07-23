import { Router, Request, Response, NextFunction } from "express";
import {
  SystemErrorTypes,
  UserErrorTypes,
  ValidationErrorTypes,
  RequestErrorTypes,
} from "../../../../interfaces/shared/errors";
import { ErrorResponseAPIBase } from "../../../../interfaces/shared/apis/types";
import { ResponseSuccessLogin } from "../../../../interfaces/shared/apis/shared/login/types";
import { buscarAdministradorPorNombreUsuarioSelect } from "../../../../core/databases/queries/administradores/buscarAdministradorPorNombreUsuario";
import { verifyPassword } from "../../../../lib/helpers/encriptations/passwords.encriptation";
import { generateAdministradorToken } from "../../../../lib/helpers/functions/jwt/generators/administradorToken";
import { TiposUsuario } from "../../../../interfaces/shared/TiposUsuario";
import { r2StorageClient } from "../../../../core/buckets/connectors/CloudfareR2";
import { Genero } from "../../../../interfaces/shared/Genero";
import { ADMINISTRADORES_SESSION_EXPIRATION } from "../../../../constants/EXPIRACIONES_JWT";
import { LoginAdminInput, loginAdminSchema } from "./schemas.zod";

const loginAdministradorRouter = Router();

// =======================================================================================
//                             DOCUMENTACIÓN SWAGGER / OPENAPI                            
// =======================================================================================
/**
 * @openapi
 * /login/administrador:
 *   post:
 *     summary: Inicio de sesión para administradores
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
 *                 description: "De 8 a 20 caracteres. Solo minúsculas, números, puntos y '_'. No puede iniciar con número."
 *               Contraseña:
 *                 type: string
 *                 minLength: 8
 *                 maxLength: 20
 *                 example: "Password123!"
 *                 description: "De 8 a 20 caracteres."
 *     responses:
 *       200:
 *         description: Login exitoso.
 *       400:
 *         description: Parámetros requeridos faltantes o con formato/longitud inválidos.
 *       401:
 *         description: Credenciales inválidas.
 *       500:
 *         description: Error interno del servidor.
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
    // A. Validar con Zod de forma segura
    const validation = loginAdminSchema.safeParse(req.body);

    if (!validation.success) {
      const issue = validation.error.issues[0];
      const messageCode = issue.message;

      // En caso falten campos obligatorios
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

      // Nombre de usuario fuera de reglas (longitud/formato/regex)
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

      // Fallback para cualquier otro caso no contemplado
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "Error de validación en la solicitud",
        errorType: ValidationErrorTypes.INVALID_FORMAT,
      };
      return res.status(400).json(errorResponse);
    }

    // Datos extraídos directamente de la validación exitosa de Zod
    const { Nombre_Usuario, Contraseña }: LoginAdminInput = validation.data;

    // Buscar el administrador por nombre de usuario
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

    // C. Verificar la contraseña
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

    // D. Generar token JWT
    const token = generateAdministradorToken(
      administrador.Id_Administrador,
      administrador.Nombre_Usuario,
    );

    // E. Obtener URL prefirmada de foto de perfil en R2 si aplica
    const url_presigned =
      administrador.Ruta_Foto_Perfil &&
      (await r2StorageClient.getPresignedDownloadUrl(
        administrador.Ruta_Foto_Perfil,
        ADMINISTRADORES_SESSION_EXPIRATION + 300,
      ));

    // F. Respuesta exitosa
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

export default loginAdministradorRouter;
