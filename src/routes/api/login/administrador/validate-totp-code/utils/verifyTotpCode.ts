import * as OTPAuth from "otpauth";

/**
 * Valida si un código TOTP de 6 dígitos es correcto para un secreto dado.
 *
 * @param code Código numérico de 6 dígitos enviado por el usuario.
 * @param secret Secreto TOTP del usuario almacenado en la BD.
 * @param periodInSeconds Duración de validez del código (ej. 30, 60 segundos).
 * @returns boolean 'true' si el código es válido dentro de la ventana de tiempo.
 */
export function verifyTotpCode(
  code: string,
  secret: string,
  periodInSeconds: number = 30,
): boolean {
  const totp = new OTPAuth.TOTP({
    issuer: "TuSistema",
    label: "Admin",
    algorithm: "SHA1",
    digits: 6,
    period: periodInSeconds,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  // delta evalúa la ventana de tiempo. Retorna null si el código es inválido.
  const delta = totp.validate({
    token: code,
    window: 1, // Permite un margen de +/- 1 periodo por desfase de reloj
  });

  return delta !== null;
}
