import { query } from "../../connectors/Postgres";

/**
 * Verifica si el correo ya pertenece a algún Administrador registrado
 */
export async function existeCorreoEnSistema(correo: string): Promise<boolean> {
  const sql = `
    SELECT 1 
    FROM "T_Administradores" 
    WHERE "Correo" = $1
    LIMIT 1;
  `;
  const result = await query(sql, [correo]);
  return (result.rowCount ?? 0) > 0;
}
