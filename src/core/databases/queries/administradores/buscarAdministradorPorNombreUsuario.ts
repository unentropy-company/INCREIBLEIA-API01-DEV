import { T_Administradores } from "@prisma/client";
import { query } from "../../connectors/Postgres";

/**
 * Busca un administrador por su nombre de usuario
 * @param nombreUsuario Nombre de usuario del administrador
 * @returns Datos del administrador o null si no existe
 */
export async function buscarAdministradorPorNombreUsuario(
  nombreUsuario: string,
): Promise<T_Administradores | null> {
  const sql = `
    SELECT *
    FROM "T_Administradores"
    WHERE "Nombre_Usuario" = $1
  `;

  const result = await query<T_Administradores>(sql, [nombreUsuario]);

  if (result.rows.length > 0) {
    return result.rows[0];
  }

  return null;
}

/**
 * Busca un administrador por su nombre de usuario y selecciona campos específicos
 * @param nombreUsuario Nombre de usuario del administrador
 * @param campos Campos específicos a seleccionar (keyof T_Administradores)
 * @returns Datos parciales del administrador o null si no existe
 */
export async function buscarAdministradorPorNombreUsuarioSelect<
  K extends keyof T_Administradores,
>(
  nombreUsuario: string,
  campos: K[],
): Promise<Pick<T_Administradores, K> | null> {
  const camposStr = campos.map((campo) => `"${String(campo)}"`).join(", ");

  const sql = `
    SELECT ${camposStr}
    FROM "T_Administradores"
    WHERE "Nombre_Usuario" = $1
  `;

  const result = await query<Pick<T_Administradores, K>>(sql, [nombreUsuario]);

  if (result.rows.length > 0) {
    return result.rows[0];
  }

  return null;
}
