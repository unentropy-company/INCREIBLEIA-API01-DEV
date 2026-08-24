import { query } from "../../connectors/Postgres";

/**
 * Obtiene la ruta (key) actual de la foto de perfil de un Administrador
 * @param idAdministrador ID del Administrador
 * @returns string con la ruta si existe, o null si no tiene foto o no existe
 */
export async function obtenerRutaFotoPerfilAdministrador(
  idAdministrador: number,
): Promise<string | null> {
  const sql = `
    SELECT "Ruta_Foto_Perfil"
    FROM "T_Administradores"
    WHERE "Id_Administrador" = $1
    LIMIT 1
  `;

  const result = await query(sql, [idAdministrador]);

  if (result.rows.length === 0) return null;

  return result.rows[0].Ruta_Foto_Perfil ?? null;
}
