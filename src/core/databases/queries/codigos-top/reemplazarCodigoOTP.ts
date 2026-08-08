import { query } from "../../connectors/Postgres";


/**
 * Invalida/Elimina cualquier OTP previo activo para este usuario antes de crear uno nuevo.
 */
export async function reemplazarCodigoOTP(params: {
  codigo: string;
  timestampCreacion: bigint;
  timestampExpiracion: bigint;
  correoDestino: string;
  tipoUsuario: string;
  idUsuario: string;
}): Promise<void> {
  const {
    codigo,
    timestampCreacion,
    timestampExpiracion,
    correoDestino,
    tipoUsuario,
    idUsuario,
  } = params;

  // 1. Limpiar OTPs anteriores para el mismo usuario y tipo
  const deleteSql = `
    DELETE FROM "T_Codigos_OTP"
    WHERE "Id_Usuario" = $1 AND "Tipo_Usuario" = $2;
  `;
  await query(deleteSql, [idUsuario, tipoUsuario]);

  // 2. Insertar el nuevo código
  const insertSql = `
    INSERT INTO "T_Codigos_OTP" (
      "Codigo",
      "Timestamp_Creacion",
      "Timestamp_Expiracion",
      "Correo_Destino",
      "Tipo_Usuario",
      "Id_Usuario"
    )
    VALUES ($1, $2, $3, $4, $5, $6);
  `;

  await query(insertSql, [
    codigo,
    timestampCreacion.toString(),
    timestampExpiracion.toString(),
    correoDestino,
    tipoUsuario,
    idUsuario,
  ]);
}
