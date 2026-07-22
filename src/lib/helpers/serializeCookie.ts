import { serialize } from "cookie";
import { DIRECTIVOS_SESSION_EXPIRATION } from "../../constants/EXPIRACIONES_JWT";

// Función para crear una cookie serializada
export default function createCookie(name: string, value: string): string {
  return serialize(name, value, {
    // httpOnly: name === "token", // Solo el token debe ser httpOnly
    // secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    secure: true,
    path: "/",
    sameSite: "strict",
    maxAge: DIRECTIVOS_SESSION_EXPIRATION, // Convertir horas a segundos
  });
}
