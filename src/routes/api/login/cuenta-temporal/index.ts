import { NextFunction, Request, Response, Router } from "express";
import {
  LoginBody,
  ResponseSuccessLogin,
} from "../../../../interfaces/shared/apis/shared/login/types";
import { ErrorResponseAPIBase } from "../../../../interfaces/shared/apis/types";
import {
  RequestErrorTypes,
  SystemErrorTypes,
  UserErrorTypes,
} from "../../../../interfaces/shared/errors";
import { buscarCuentaTemporalPorNombreUsuarioSelect } from "../../../../core/databases/queries/cuentas-temporales/buscarCuentaTemporalPorNombreUsuario";
import { verifyPassword } from "../../../../lib/helpers/encriptations/passwords.encriptation";
import { generateCuentaTemporalToken } from "../../../../lib/helpers/functions/jwt/generators/cuentaTemporalToken";
import { TiposUsuario } from "../../../../interfaces/shared/TiposUsuario";

const loginCuentaTemporalRouter = Router();

// Ruta de login para Cuentas Temporales
loginCuentaTemporalRouter.post("/", (async (
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

    // Buscar la cuenta temporal por nombre de usuario con campos específicos
    const cuentaTemporal = await buscarCuentaTemporalPorNombreUsuarioSelect(
      Nombre_Usuario,
      [
        "Id_Cuenta_Temporal",
        "Nombre_Usuario_Temporal",
        "Contraseña_Usuario_Temporal",
        "Nombres_Persona",
        "Apellidos_Persona",
        "Fecha_Hora_Inicio",
        "Fecha_Hora_Final",
      ],
    );

    // Si no existe la cuenta temporal, retornar error
    if (!cuentaTemporal) {
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "Credenciales inválidas",
        errorType: UserErrorTypes.INVALID_CREDENTIALS,
      };
      return res.status(401).json(errorResponse);
    }

    // Verificar que la cuenta ya esté dentro de su ventana de vigencia
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

    // Verificar la contraseña
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

    // Generar token JWT
    const token = generateCuentaTemporalToken(
      cuentaTemporal.Id_Cuenta_Temporal,
      cuentaTemporal.Nombre_Usuario_Temporal,
    );

    const response: ResponseSuccessLogin = {
      success: true,
      message: "Inicio de sesión exitoso",
      data: {
        Nombre_Usuario: cuentaTemporal.Nombre_Usuario_Temporal,
        Tipo_Usuario: TiposUsuario.Cuenta_Temporal,
        Nombres: cuentaTemporal.Nombres_Persona,
        Apellidos: cuentaTemporal.Apellidos_Persona,
        Foto_Perfil_URL: null, // Asumiendo que las cuentas temporales no tienen foto de perfil
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

export default loginCuentaTemporalRouter;
