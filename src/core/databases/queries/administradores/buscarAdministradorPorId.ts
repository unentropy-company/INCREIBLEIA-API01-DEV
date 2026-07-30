import { T_Administradores } from "@prisma/client";
import { query } from "../../connectors/Postgres";

/**
 * Busca un administrador por su ID
 * @param idAdministrador ID del administrador
 * @returns Datos del administrador o null si no existe
 */
export async function buscarAdministradorPorId(
  idAdministrador: number,
): Promise<T_Administradores | null> {
  const sql = `
    SELECT *
    FROM "T_Administradores"
    WHERE "Id_Administrador" = $1
  `;

  const result = await query<T_Administradores>(sql, [idAdministrador]);

  if (result.rows.length > 0) {
    return result.rows[0];
  }

  return null;
}

/**
 * Busca un administrador por su ID y selecciona campos específicos
 * @param idAdministrador ID del administrador
 * @param campos Campos específicos a seleccionar (keyof T_Administradores)
 * @returns Datos parciales del administrador o null si no existe
 */
export async function buscarAdministradorPorIdSelect<
  K extends keyof T_Administradores,
>(
  idAdministrador: number,
  campos: K[],
): Promise<Pick<T_Administradores, K> | null> {
  const camposStr = campos.map((campo) => `"${String(campo)}"`).join(", ");

  const sql = `
    SELECT ${camposStr}
    FROM "T_Administradores"
    WHERE "Id_Administrador" = $1
  `;

  const result = await query<Pick<T_Administradores, K>>(sql, [
    idAdministrador,
  ]);

  if (result.rows.length > 0) {
    return result.rows[0];
  }

  return null;
}
