import { query } from "../../connectors/Postgres";

/**
 * Actualiza el correo del Administrador de forma atómica en la base de datos.
 */
export async function actualizarCorreoAdministrador(
  idAdmin: number,
  nuevoCorreo: string,
): Promise<void> {
  const sql = `
    UPDATE "T_Administradores"
    SET "Correo" = $1
    WHERE "Id_Administrador" = $2;
  `;
  await query(sql, [nuevoCorreo, idAdmin]);
}
