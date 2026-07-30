import { query } from "../../connectors/Postgres";

export interface ActualizarTotpInput {
  Totp_Secret: string;
  Duracion_Codigos_Totp_Segundos: number;
}

/**
 * Actualiza el secreto TOTP y la duración de validez de un administrador.
 *
 * @param idAdministrador ID único del Administrador
 * @param datos Objeto con Totp_Secret y Duracion_Codigos_Totp_Segundos
 * @returns boolean indicando si la actualización afectó a alguna fila
 */
export async function actualizarTotpAdministrador(
  idAdministrador: number,
  datos: ActualizarTotpInput,
): Promise<boolean> {
  const sql = `
    UPDATE "T_Administradores"
    SET 
      "Totp_Secret" = $1,
      "Duracion_Codigos_Totp_Segundos" = $2
    WHERE "Id_Administrador" = $3
  `;

  const result = await query(sql, [
    datos.Totp_Secret,
    datos.Duracion_Codigos_Totp_Segundos,
    idAdministrador,
  ]);

  return (result.rowCount ?? 0) > 0;
}
