import { query } from "../../connectors/Postgres";

/**
 * Actualiza la ruta (key) de la foto de perfil de una Cuenta Temporal
 * @param idCuentaTemporal ID de la Cuenta Temporal
 * @param rutaFotoPerfil Ruta del archivo dentro del bucket R2
 * @returns boolean 'true' si se realizó la actualización
 */
export async function actualizarRutaFotoPerfilCuentaTemporal(
  idCuentaTemporal: number,
  rutaFotoPerfil: string,
): Promise<boolean> {
  const sql = `
    UPDATE "T_Cuentas_Temporales"
    SET "Ruta_Foto_Perfil" = $1
    WHERE "Id_Cuenta_Temporal" = $2
  `;

  const result = await query(sql, [rutaFotoPerfil, idCuentaTemporal]);
  return (result.rowCount ?? 0) > 0;
}
