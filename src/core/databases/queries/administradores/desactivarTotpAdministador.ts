import { query } from "../../connectors/Postgres";

/**
 * Desactiva la autenticación TOTP de un Administrador estableciendo sus campos a NULL.
 *
 * @param idAdministrador ID del administrador a actualizar
 * @returns boolean indicando si la actualización afectó a alguna fila
 */
export async function desactivarTotpAdministrador(
  idAdministrador: number,
): Promise<boolean> {
  const sql = `
    UPDATE "T_Administradores"
    SET 
      "Totp_Secret" = NULL,
      "Duracion_Codigos_Totp_Segundos" = NULL
    WHERE "Id_Administrador" = $1
  `;

  const result = await query(sql, [idAdministrador]);

  return (result.rowCount ?? 0) > 0;
}
