import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { TiposUsuario } from "../interfaces/shared/TiposUsuario";
import {
  JWTPayload,
  CuentaTemporalAuthenticated,
} from "../interfaces/shared/JWTPayload";
import {
  TokenErrorTypes,
  UserErrorTypes,
  AuthenticationErrorTypes,
} from "../interfaces/shared/errors";
import { buscarCuentaTemporalPorIdSelect } from "../core/databases/queries/cuentas-temporales/buscarCuentaTemporalPorId";

export const isCuentaTemporalAuthenticated = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.userType !== TiposUsuario.Cuenta_Temporal) {
    return next();
  }

  const token = (req as any).rawToken;
  const jwtSecret = process.env.JWT_KEY_CUENTAS_TEMPORALES!;

  try {
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;

    // 1. Traer solo los campos requeridos para la validación de negocio
    const cuentaTemporal = await buscarCuentaTemporalPorIdSelect(
      decoded.Id_Usuario,
      [
        "Id_Cuenta_Temporal",
        "Nombre_Usuario_Temporal",
        "Fecha_Hora_Final",
        "Estado",
      ],
    );

    // 2. Validar existencia
    if (!cuentaTemporal) {
      req.authError = {
        type: UserErrorTypes.USER_NOT_FOUND,
        message: "La cuenta temporal no existe",
      };
      return next();
    }

    // 3. Validar estado (inactiva / dada de baja)
    if (!cuentaTemporal.Estado) {
      req.authError = {
        type: UserErrorTypes.USER_INACTIVE,
        message: "La cuenta temporal se encuentra inactiva",
      };
      return next();
    }

    // 4. Validar si la fecha actual UTC sobrepasa la fecha final UTC de la cuenta
    const fechaActualUtc = new Date().getTime();
    const fechaHoraFinalUtc = new Date(
      cuentaTemporal.Fecha_Hora_Final,
    ).getTime();

    if (fechaActualUtc > fechaHoraFinalUtc) {
      req.authError = {
        type: AuthenticationErrorTypes.TEMPORARY_ACCOUNT_EXPIRED,
        message: "El periodo de vigencia de esta cuenta temporal ha finalizado",
      };
      return next();
    }

    // 5. Inyectar usuario autenticado
    req.user = {
      Id_Cuenta_Temporal: cuentaTemporal.Id_Cuenta_Temporal,
      Nombre_Usuario: cuentaTemporal.Nombre_Usuario_Temporal,
    } as CuentaTemporalAuthenticated;

    req.isAuthenticated = true;
    next();
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      req.authError = {
        type: TokenErrorTypes.TOKEN_EXPIRED,
        message: "El token de la cuenta temporal ha expirado",
      };
    } else {
      req.authError = {
        type: TokenErrorTypes.TOKEN_INVALID_SIGNATURE,
        message: "Firma de token inválida para Cuenta Temporal",
      };
    }
    next();
  }
};

export default isCuentaTemporalAuthenticated;
