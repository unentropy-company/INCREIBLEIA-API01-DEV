import { query } from "../../connectors/Postgres";

/**
 * Obtiene la ruta (key) actual de la foto de perfil de una Cuenta Temporal
 * @param idCuentaTemporal ID de la Cuenta Temporal
 * @returns string con la ruta si existe, o null si no tiene foto o no existe
 */
export async function obtenerRutaFotoPerfilCuentaTemporal(
  idCuentaTemporal: number,
): Promise<string | null> {
  const sql = `
    SELECT "Ruta_Foto_Perfil"
    FROM "T_Cuentas_Temporales"
    WHERE "Id_Cuenta_Temporal" = $1
    LIMIT 1
  `;

  const result = await query(sql, [idCuentaTemporal]);

  if (result.rows.length === 0) return null;

  return result.rows[0].Ruta_Foto_Perfil ?? null;
}
