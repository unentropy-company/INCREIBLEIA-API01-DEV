import jwt from "jsonwebtoken";

import { TokenErrorTypes } from "../../../../interfaces/shared/errors";
import { JWTPayload } from "../../../../interfaces/shared/JWTPayload";
import { TiposUsuario } from "../../../../interfaces/shared/TiposUsuario";

interface TokenPreliminaryCheck {
  isValid: boolean;
  message: string;
  errorType?: TokenErrorTypes;
  payload?: JWTPayload;
}

/**
 * Verifica preliminarmente un token JWT sin validar su firma.
 * Esto permite verificar la estructura y extraer el tipo de usuario sin realizar
 * la verificación criptográfica completa (esa se hace después con la clave
 * secreta correspondiente al Tipo_Usuario detectado).
 *
 * @param token El token JWT a verificar preliminarmente
 * @returns Un objeto con información sobre la validez del token y su payload
 */
export default function verifyGenericJWTToken(
  token: string
): TokenPreliminaryCheck {
  try {
    // Decodificar el token sin verificar la firma
    const decoded = jwt.decode(token, { complete: true });

    if (!decoded) {
      return {
        isValid: false,
        message: "Token malformado o inválido",
        errorType: TokenErrorTypes.TOKEN_MALFORMED,
      };
    }

    // Verificar la estructura básica del payload
    const payload = decoded.payload as JWTPayload;

    if (!payload || typeof payload !== "object") {
      return {
        isValid: false,
        message: "Payload del token es inválido",
        errorType: TokenErrorTypes.TOKEN_MALFORMED,
      };
    }

    // Verificar que exista el identificador de usuario
    if (!payload.Id_Usuario) {
      return {
        isValid: false,
        message: "Token no contiene identificador de usuario",
        errorType: TokenErrorTypes.TOKEN_MALFORMED,
        payload,
      };
    }

    // Verificar que exista el nombre de usuario
    if (!payload.Nombre_Usuario) {
      return {
        isValid: false,
        message: "Token no contiene nombre de usuario",
        errorType: TokenErrorTypes.TOKEN_MALFORMED,
        payload,
      };
    }

    // Verificar que exista el tipo de usuario y que sea un valor válido del enum
    if (
      !payload.Tipo_Usuario ||
      !Object.values(TiposUsuario).includes(payload.Tipo_Usuario)
    ) {
      return {
        isValid: false,
        message: "Token no contiene un tipo de usuario válido",
        errorType: TokenErrorTypes.TOKEN_MALFORMED,
        payload,
      };
    }

    // Verificar que el token tenga fecha de expiración
    if (!payload.exp) {
      return {
        isValid: false,
        message: "Token no contiene fecha de expiración",
        errorType: TokenErrorTypes.TOKEN_MALFORMED,
        payload,
      };
    }

    // Verificar si el token ha expirado
    if (Date.now() >= payload.exp * 1000) {
      return {
        isValid: false,
        message: "Token expirado",
        errorType: TokenErrorTypes.TOKEN_EXPIRED,
        payload,
      };
    }

    return {
      isValid: true,
      message: "Token válido preliminarmente",
      payload,
    };
  } catch {
    return {
      isValid: false,
      message: "Error al procesar el token",
      errorType: TokenErrorTypes.TOKEN_MALFORMED,
    };
  }
}