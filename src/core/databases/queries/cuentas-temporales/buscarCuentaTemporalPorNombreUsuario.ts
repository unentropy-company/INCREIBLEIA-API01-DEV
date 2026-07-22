import { T_Cuentas_Temporales } from "@prisma/client";
import { query } from "../../connectors/Postgres";

/**
 * Busca una cuenta temporal por su nombre de usuario temporal
 * @param nombreUsuarioTemporal Nombre de usuario de la cuenta temporal
 * @returns Datos de la cuenta temporal o null si no existe
 */
export async function buscarCuentaTemporalPorNombreUsuario(
  nombreUsuarioTemporal: string,
): Promise<T_Cuentas_Temporales | null> {
  const sql = `
    SELECT *
    FROM "T_Cuentas_Temporales"
    WHERE "Nombre_Usuario_Temporal" = $1
  `;

  const result = await query<T_Cuentas_Temporales>(sql, [
    nombreUsuarioTemporal,
  ]);

  if (result.rows.length > 0) {
    return result.rows[0];
  }

  return null;
}

/**
 * Busca una cuenta temporal por su nombre de usuario temporal y selecciona campos específicos
 * @param nombreUsuarioTemporal Nombre de usuario de la cuenta temporal
 * @param campos Campos específicos a seleccionar (keyof T_Cuentas_Temporales)
 * @returns Datos parciales de la cuenta temporal o null si no existe
 */
export async function buscarCuentaTemporalPorNombreUsuarioSelect<
  K extends keyof T_Cuentas_Temporales,
>(
  nombreUsuarioTemporal: string,
  campos: K[],
): Promise<Pick<T_Cuentas_Temporales, K> | null> {
  const camposStr = campos.map((campo) => `"${String(campo)}"`).join(", ");

  const sql = `
    SELECT ${camposStr}
    FROM "T_Cuentas_Temporales"
    WHERE "Nombre_Usuario_Temporal" = $1
  `;

  const result = await query<Pick<T_Cuentas_Temporales, K>>(sql, [
    nombreUsuarioTemporal,
  ]);

  if (result.rows.length > 0) {
    return result.rows[0];
  }

  return null;
}
