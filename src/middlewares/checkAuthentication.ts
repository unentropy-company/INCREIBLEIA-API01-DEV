import { Request, Response, NextFunction } from "express";
import { ErrorResponseAPIBase } from "../interfaces/shared/apis/types";
import {
  PermissionErrorTypes,
  TokenErrorTypes,
} from "../interfaces/shared/errors";

export const checkAuthentication = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Si el usuario se autenticó correctamente en alguno de los middlewares atómicos
  if (req.isAuthenticated && req.user) {
    return next();
  }

  // Si un middleware previo registró un error específico durante la verificación
  if (req.authError) {
    const errorType = String(req.authError.type);

    // Determinar Status Code de forma limpia:
    // - 500 para errores de servidor o BD (SYSTEM_*, DATABASE_*)
    // - 401 para problemas directos de token (TOKEN_EXPIRED, TOKEN_INVALID_SIGNATURE, TOKEN_MALFORMED, etc.)
    // - 403 para usuarios inactivos, cuentas expiradas o permisos insuficientes (USER_INACTIVE, TEMPORARY_ACCOUNT_EXPIRED, etc.)
    let statusCode = 403;

    if (errorType.includes("SYSTEM") || errorType.includes("DATABASE")) {
      statusCode = 500;
    } else if (
      errorType.startsWith("TOKEN_") &&
      errorType !== TokenErrorTypes.TOKEN_UNAUTHORIZED &&
      errorType !== TokenErrorTypes.TOKEN_WRONG_ROLE
    ) {
      statusCode = 401;
    }

    const errorResponse: ErrorResponseAPIBase = {
      success: false,
      message: req.authError.message,
      errorType: req.authError.type,
      ...(req.authError.details && { details: req.authError.details }),
    };

    return res.status(statusCode).json(errorResponse);
  }

  // Si no se autenticó ni registró un error previo (el tipo de usuario no era el permitido para esta ruta)
  const errorResponse: ErrorResponseAPIBase = {
    success: false,
    message:
      "Acceso denegado. No posee los permisos necesarios para este recurso.",
    errorType: PermissionErrorTypes.INSUFFICIENT_PERMISSIONS,
  };

  return res.status(403).json(errorResponse);
};

export default checkAuthentication;
