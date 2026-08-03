import { query } from "../../connectors/Postgres";

/**
 * Actualiza la ruta (key) de la foto de perfil de un Administrador
 * @param idAdministrador ID del Administrador
 * @param rutaFotoPerfil Ruta del archivo dentro del bucket R2
 * @returns boolean 'true' si se realizó la actualización
 */
export async function actualizarRutaFotoPerfilAdministrador(
  idAdministrador: number,
  rutaFotoPerfil: string,
): Promise<boolean> {
  const sql = `
    UPDATE "T_Administradores"
    SET "Ruta_Foto_Perfil" = $1
    WHERE "Id_Administrador" = $2
  `;

  const result = await query(sql, [rutaFotoPerfil, idAdministrador]);
  return (result.rowCount ?? 0) > 0;
}
