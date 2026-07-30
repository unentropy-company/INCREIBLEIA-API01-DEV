import { T_Cuentas_Temporales } from "@prisma/client";
import { query } from "../../connectors/Postgres";

/**
 * Busca una cuenta temporal por su ID
 * @param idCuentaTemporal ID de la cuenta temporal
 * @returns Datos de la cuenta temporal o null si no existe
 */
export async function buscarCuentaTemporalPorId(
  idCuentaTemporal: number,
): Promise<T_Cuentas_Temporales | null> {
  const sql = `
    SELECT *
    FROM "T_Cuentas_Temporales"
    WHERE "Id_Cuenta_Temporal" = $1
  `;

  const result = await query<T_Cuentas_Temporales>(sql, [idCuentaTemporal]);

  if (result.rows.length > 0) {
    return result.rows[0];
  }

  return null;
}

/**
 * Busca una cuenta temporal por su ID y selecciona campos específicos
 * @param idCuentaTemporal ID de la cuenta temporal
 * @param campos Campos específicos a seleccionar (keyof T_Cuentas_Temporales)
 * @returns Datos parciales de la cuenta temporal o null si no existe
 */
export async function buscarCuentaTemporalPorIdSelect<
  K extends keyof T_Cuentas_Temporales,
>(
  idCuentaTemporal: number,
  campos: K[],
): Promise<Pick<T_Cuentas_Temporales, K> | null> {
  const camposStr = campos.map((campo) => `"${String(campo)}"`).join(", ");

  const sql = `
    SELECT ${camposStr}
    FROM "T_Cuentas_Temporales"
    WHERE "Id_Cuenta_Temporal" = $1
  `;

  const result = await query<Pick<T_Cuentas_Temporales, K>>(sql, [
    idCuentaTemporal,
  ]);

  if (result.rows.length > 0) {
    return result.rows[0];
  }

  return null;
}
