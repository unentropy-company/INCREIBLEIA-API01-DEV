import { query } from "../../connectors/Postgres";

export async function obtenerContraseñaCuentaTemporal(
  idCuentaTemporal: number,
): Promise<string | null> {
  const sql = `
    SELECT "Contrasena_Temporal" AS "Contrasena"
    FROM "T_Cuentas_Temporales"
    WHERE "Id_Cuenta_Temporal" = $1
    LIMIT 1;
  `;
  const result = await query(sql, [idCuentaTemporal]);
  return result.rows[0]?.Contrasena ?? null;
}

export async function actualizarContraseñaCuentaTemporal(
  idCuentaTemporal: number,
  nuevaContrasenaHash: string,
): Promise<boolean> {
  const sql = `
    UPDATE "T_Cuentas_Temporales"
    SET "Contrasena_Temporal" = $1
    WHERE "Id_Cuenta_Temporal" = $2;
  `;
  const result = await query(sql, [nuevaContrasenaHash, idCuentaTemporal]);
  return (result.rowCount ?? 0) > 0;
}
