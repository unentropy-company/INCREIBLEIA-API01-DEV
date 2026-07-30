import "dotenv/config";
import jwt from "jsonwebtoken";
import { JWTPayloadForTotpOperationsInAuthenticationForAdministradores } from "../../../../../interfaces/shared/JWTPayload";
import { LOGIN_TOTP_OPERATION_EXPIRATION_SECONDS } from "../../../../../constants/TOTP_CONFIGURATION";

/**
 * Genera un token JWT de corta duración (5 minutos y medio) exclusivo
 * para autorizar la verificación del segundo factor (TOTP) durante el login.
 *
 * @param Id_Administrador ID del administrador autenticado en primer factor.
 * @param Nombre_Usuario Nombre de usuario del administrador.
 * @returns Token JWT firmado como string.
 */
export function generateTotpOperationToken(
  Id_Administrador: number,
  Nombre_Usuario: string,
): string {
  const secret = process.env.LOGIN_TOTP_OPERATION_SECRET;

  if (!secret) {
    throw new Error(
      "VARIABLE_DE_ENTORNO_FALTANTE: LOGIN_TOTP_OPERATION_SECRET no está definida.",
    );
  }

  const payload: JWTPayloadForTotpOperationsInAuthenticationForAdministradores =
    {
      Id_Administrador,
      Nombre_Usuario,
      iat: Math.floor(Date.now() / 1000),
      exp:
        Math.floor(Date.now() / 1000) + LOGIN_TOTP_OPERATION_EXPIRATION_SECONDS,
    };

  return jwt.sign(payload, secret);
}
