import * as bcrypt from "bcrypt";

// Se usaran 12 rondas como el estándar actual recomendado, pues ofrece una seguridad muy alta
// sin ralentizar perceptiblemente el inicio de sesión de los usuarios.
const SALT_ROUNDS = 12;

/**
 * Hashea una contraseña usando bcrypt de forma irreversible
 * @param {string} password - La contraseña en texto plano a hashear
 * @returns {Promise<string>} - El hash resultante listo para guardar en la base de datos
 */
export async function encryptPassword(
  password: string,
): Promise<string> {
  try {
    // bcrypt genera automáticamente el 'salt' aleatorio internamente y lo incluye en el hash final
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    return hash;
  } catch (error) {
    console.error("Error al hashear la contraseña:", error);
    throw new Error("No se pudo procesar la contraseña de forma segura");
  }
}

/**
 * Verifica si una contraseña coincide con el hash almacenado en la base de datos
 * @param {string} password - La contraseña en texto plano que ingresa el usuario
 * @param {string} hashedPassword - El hash recuperado de la base de datos para comparar
 * @returns {Promise<boolean>} - true si coinciden, false si no
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string,
): Promise<boolean> {
  try {
    // bcrypt descifra el salt del propio hash y realiza la comparación de forma segura
    return await bcrypt.compare(password, hashedPassword);
  } catch (error) {
    console.error("Error al verificar la contraseña:", error);
    return false;
  }
}
