import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { TiposUsuario } from "../interfaces/shared/TiposUsuario";
import {
  JWTPayload,
  AdministradorAuthenticated,
} from "../interfaces/shared/JWTPayload";
import { TokenErrorTypes, UserErrorTypes } from "../interfaces/shared/errors";
import { buscarAdministradorPorId } from "../core/databases/queries/administradores/buscarAdministradorPorId";

export const isAdministradorAuthenticated = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Si no es un Administrador, simplemente delegamos o pasamos al siguiente
  if (req.userType !== TiposUsuario.Administrador) {
    return next();
  }

  const token = (req as any).rawToken;
  const jwtSecret = process.env.JWT_KEY_ADMINISTRADORES!;

  try {
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;

    // Verificar existencia del usuario en la base de datos
    const admin = await buscarAdministradorPorId(decoded.Id_Usuario);

    if (!admin) {
      req.authError = {
        type: UserErrorTypes.USER_INACTIVE,
        message: "La cuenta de administrador no existe o está inactiva",
      };
      return next();
    }

    // Inyección de datos
    req.user = {
      Id_Administrador: admin.Id_Administrador,
      Nombre_Usuario: admin.Nombre_Usuario,
    } as AdministradorAuthenticated;

    req.isAuthenticated = true;
    next();
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      req.authError = {
        type: TokenErrorTypes.TOKEN_EXPIRED,
        message: "El token de administrador ha expirado",
      };
    } else {
      req.authError = {
        type: TokenErrorTypes.TOKEN_INVALID_SIGNATURE,
        message: "Firma de token inválida para Administrador",
      };
    }
    next();
  }
};

export default isAdministradorAuthenticated;
