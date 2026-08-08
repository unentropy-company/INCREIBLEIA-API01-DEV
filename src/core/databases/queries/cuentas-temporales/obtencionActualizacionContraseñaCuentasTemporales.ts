import { query } from "../../connectors/Postgres";

/**
 * Obtiene el hash de contraseña actual de una cuenta temporal
 * @param idCuentaTemporal ID de la cuenta temporal
 * @returns Hash de la contraseña o null si la cuenta no existe
 */
export async function obtenerContraseñaCuentaTemporal(
  idCuentaTemporal: number,
): Promise<string | null> {
  const sql = `
    SELECT "Contraseña_Usuario_Temporal"
    FROM "T_Cuentas_Temporales"
    WHERE "Id_Cuenta_Temporal" = $1
  `;

  const result = await query<{ Contraseña_Usuario_Temporal: string }>(sql, [
    idCuentaTemporal,
  ]);

  if (result.rows.length > 0) {
    return result.rows[0].Contraseña_Usuario_Temporal;
  }

  return null;
}

/**
 * Actualiza la contraseña (ya hasheada) de una cuenta temporal
 * @param idCuentaTemporal ID de la cuenta temporal
 * @param nuevaContraseñaHasheada Hash de la nueva contraseña
 * @returns true si se actualizó al menos una fila, false en caso contrario
 */
export async function actualizarContraseñaCuentaTemporal(
  idCuentaTemporal: number,
  nuevaContraseñaHasheada: string,
): Promise<boolean> {
  const sql = `
    UPDATE "T_Cuentas_Temporales"
    SET "Contraseña_Usuario_Temporal" = $1
    WHERE "Id_Cuenta_Temporal" = $2
  `;

  const result = await query(sql, [nuevaContraseñaHasheada, idCuentaTemporal]);

  return (result.rowCount ?? 0) > 0;
}