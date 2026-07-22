import "dotenv/config";
import jwt from "jsonwebtoken";
import { JWTPayload } from "../../../../../interfaces/shared/JWTPayload";
import { TiposUsuario } from "../../../../../interfaces/shared/TiposUsuario";
import { CUENTAS_TEMPORALES_SESSION_EXPIRATION } from "../../../../../constants/EXPIRACIONES_JWT";

// Función para generar un token JWT para cuentas temporales
export function generateCuentaTemporalToken(
  cuentaTemporalId: number,
  nombre_usuario: string,
): string {
  const jwtSecretKey = process.env.JWT_KEY_CUENTAS_TEMPORALES!;

  const payload: JWTPayload = {
    Id_Usuario: cuentaTemporalId,
    Nombre_Usuario: nombre_usuario,
    Tipo_Usuario: TiposUsuario.Cuenta_Temporal,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + CUENTAS_TEMPORALES_SESSION_EXPIRATION, //Duracion de Token de 5 Horas para directivos
  };

  return jwt.sign(payload, jwtSecretKey);
}
