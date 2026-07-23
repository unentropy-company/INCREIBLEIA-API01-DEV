import {
  RequestErrorTypes,
  SystemErrorTypes,
  UserErrorTypes,
} from "../../../../interfaces/shared/errors";
import { ErrorResponseAPIBase } from "../../../../interfaces/shared/apis/types";
import {
  LoginBody,
  ResponseSuccessLogin,
} from "../../../../interfaces/shared/apis/shared/login/types";
import { buscarAdministradorPorNombreUsuarioSelect } from "../../../../core/databases/queries/administradores/buscarAdministradorPorNombreUsuario";
import { NextFunction, Request, Response, Router } from "express";
import { verifyPassword } from "../../../../lib/helpers/encriptations/passwords.encriptation";
import { generateAdministradorToken } from "../../../../lib/helpers/functions/jwt/generators/administradorToken";
import { TiposUsuario } from "../../../../interfaces/shared/TiposUsuario";
import { r2StorageClient } from "../../../../core/buckets/connectors/CloudfareR2";

const loginAdministradorRouter = Router();

// Ruta de login para Administradores
loginAdministradorRouter.post("/", (async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { Nombre_Usuario, Contraseña }: LoginBody = req.body;

    // Validar que se proporcionen ambos campos
    if (!Nombre_Usuario || !Contraseña) {
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "El nombre de usuario y la contraseña son obligatorios",
        errorType: RequestErrorTypes.MISSING_PARAMETERS,
      };
      return res.status(400).json(errorResponse);
    }

    // Buscar el administrador por nombre de usuario con campos específicos
    const administrador = await buscarAdministradorPorNombreUsuarioSelect(
      Nombre_Usuario,
      [
        "Id_Administrador",
        "Nombre_Usuario",
        "Contraseña",
        "Nombres",
        "Apellidos",
        "Ruta_Foto_Perfil",
      ],
    );

    // Si no existe el administrador, retornar error
    if (!administrador) {
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "Credenciales inválidas",
        errorType: UserErrorTypes.INVALID_CREDENTIALS,
      };
      return res.status(401).json(errorResponse);
    }

    // Verificar la contraseña
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

    // Generar token JWT
    const token = generateAdministradorToken(
      administrador.Id_Administrador,
      administrador.Nombre_Usuario,
    );

    const url_presigned =
      administrador.Ruta_Foto_Perfil &&
      (await r2StorageClient.getPresignedDownloadUrl(administrador.Ruta_Foto_Perfil));

    const response: ResponseSuccessLogin = {
      success: true,
      message: "Inicio de sesión exitoso",
      data: {
        Nombre_Usuario: administrador.Nombre_Usuario,
        Tipo_Usuario: TiposUsuario.Administrador,
        Nombres: administrador.Nombres,
        Apellidos: administrador.Apellidos,
        Foto_Perfil_URL: url_presigned,
        token,
      },
    };

    // Responder con el token y datos básicos del usuario
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
