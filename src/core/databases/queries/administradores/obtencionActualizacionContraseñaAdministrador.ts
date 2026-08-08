import { query } from "../../connectors/Postgres";

/**
 * Obtiene el hash de contraseña actual de un administrador
 * @param idAdministrador ID del administrador
 * @returns Hash de la contraseña o null si el administrador no existe
 */
export async function obtenerContraseñaAdministrador(
  idAdministrador: number,
): Promise<string | null> {
  const sql = `
    SELECT "Contraseña"
    FROM "T_Administradores"
    WHERE "Id_Administrador" = $1
  `;

  const result = await query<{ Contraseña: string }>(sql, [idAdministrador]);

  if (result.rows.length > 0) {
    return result.rows[0].Contraseña;
  }

  return null;
}

/**
 * Actualiza la contraseña (ya hasheada) de un administrador
 * @param idAdministrador ID del administrador
 * @param nuevaContraseñaHasheada Hash de la nueva contraseña
 * @returns true si se actualizó al menos una fila, false en caso contrario
 */
export async function actualizarContraseñaAdministrador(
  idAdministrador: number,
  nuevaContraseñaHasheada: string,
): Promise<boolean> {
  const sql = `
    UPDATE "T_Administradores"
    SET "Contraseña" = $1
    WHERE "Id_Administrador" = $2
  `;

  const result = await query(sql, [nuevaContraseñaHasheada, idAdministrador]);

  return (result.rowCount ?? 0) > 0;
}