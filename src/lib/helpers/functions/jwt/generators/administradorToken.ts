import "dotenv/config";
import jwt from "jsonwebtoken";
import { JWTPayload } from "../../../../../interfaces/shared/JWTPayload";
import { TiposUsuario } from "../../../../../interfaces/shared/TiposUsuario";
import { ADMINISTRADORES_SESSION_EXPIRATION } from "../../../../../constants/EXPIRACIONES_JWT";

// Función para generar un token JWT para Administradores
export function generateAdministradorToken(
  idAdministrador: number,
  nombre_usuario: string,
): string {
  const jwtSecretKey = process.env.JWT_KEY_ADMINISTRADORES!;

  const payload: JWTPayload = {
    Id_Usuario: idAdministrador,
    Nombre_Usuario: nombre_usuario,
    Tipo_Usuario: TiposUsuario.Administrador,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + ADMINISTRADORES_SESSION_EXPIRATION, // Duración del token
  };

  return jwt.sign(payload, jwtSecretKey);
}
