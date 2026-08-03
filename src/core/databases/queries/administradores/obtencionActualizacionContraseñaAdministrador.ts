import { query } from "../../connectors/Postgres";

export async function obtenerContraseñaAdministrador(
  idAdministrador: number,
): Promise<string | null> {
  const sql = `
    SELECT "Contrasena"
    FROM "T_Administradores"
    WHERE "Id_Administrador" = $1
    LIMIT 1;
  `;
  const result = await query(sql, [idAdministrador]);
  return result.rows[0]?.Contrasena ?? null;
}

export async function actualizarContraseñaAdministrador(
  idAdministrador: number,
  nuevaContrasenaHash: string,
): Promise<boolean> {
  const sql = `
    UPDATE "T_Administradores"
    SET "Contrasena" = $1
    WHERE "Id_Administrador" = $2;
  `;
  const result = await query(sql, [nuevaContrasenaHash, idAdministrador]);
  return (result.rowCount ?? 0) > 0;
}
