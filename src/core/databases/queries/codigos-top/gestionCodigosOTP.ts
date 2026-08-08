import { query } from "../../connectors/Postgres";

export interface CodigoOTPRecord {
  Id_Codigo_OTP: number;
  Codigo: string;
  Timestamp_Creacion: string;
  Timestamp_Expiracion: string;
  Correo_Destino: string;
  Tipo_Usuario: string;
  Id_Usuario: string;
}

/**
 * Obtiene el código OTP activo para un Administrador específico.
 */
export async function obtenerCodigoOTPAdmin(
  idAdmin: string,
): Promise<CodigoOTPRecord | null> {
  const sql = `
    SELECT 
      "Id_Codigo_OTP",
      "Codigo",
      "Timestamp_Creacion",
      "Timestamp_Expiracion",
      "Correo_Destino",
      "Tipo_Usuario",
      "Id_Usuario"
    FROM "T_Codigos_OTP"
    WHERE "Id_Usuario" = $1 AND "Tipo_Usuario" = 'A'
    LIMIT 1;
  `;
  const result = await query(sql, [idAdmin]);
  if ((result.rowCount ?? 0) === 0) return null;
  return result.rows[0] as CodigoOTPRecord;
}

/**
 * Elimina la solicitud de OTP (por intento fallido o tras usarse con éxito).
 */
export async function eliminarCodigoOTPAdmin(idAdmin: string): Promise<void> {
  const sql = `
    DELETE FROM "T_Codigos_OTP"
    WHERE "Id_Usuario" = $1 AND "Tipo_Usuario" = 'A';
  `;
  await query(sql, [idAdmin]);
}
