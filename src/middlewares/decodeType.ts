import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { TokenErrorTypes } from "../interfaces/shared/errors";
import { JWTPayload } from "../interfaces/shared/JWTPayload";
import { ErrorResponseAPIBase } from "../interfaces/shared/apis/types";

export const decodeType = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    const errorResponse: ErrorResponseAPIBase = {
      success: false,
      message: "Token de autorización no proporcionado o con formato inválido",
      errorType: TokenErrorTypes.TOKEN_MISSING,
    };
    return res.status(401).json(errorResponse);
  }

  const token = authHeader.split(" ")[1];

  try {
    // Decodificamos el payload sin verificar la firma aún (eso lo hace cada middleware específico según la SECRET KEY)
    const decoded = jwt.decode(token) as JWTPayload | null;

    if (!decoded || !decoded.Tipo_Usuario) {
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "Estructura del token no válida",
        errorType: TokenErrorTypes.TOKEN_MALFORMED,
      };
      return res.status(401).json(errorResponse);
    }

    // Guardamos el tipo de usuario y el token raw en la request
    req.userType = decoded.Tipo_Usuario;
    (req as any).rawToken = token;

    next();
  } catch (error) {
    const errorResponse: ErrorResponseAPIBase = {
      success: false,
      message: "Error al procesar el token de autenticación",
      errorType: TokenErrorTypes.TOKEN_MALFORMED,
    };
    return res.status(401).json(errorResponse);
  }
};

export default decodeType;
