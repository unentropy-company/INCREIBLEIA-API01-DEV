import { query } from "../../connectors/Postgres";

/**
 * Actualiza el Nombre_Usuario_Temporal de una Cuenta Temporal por su ID.
 * Si el nombre de usuario ya está registrado por otra cuenta, PostgreSQL lanzará un
 * error de clave única (código 23505) que es capturado por la API.
 *
 * @param idCuentaTemporal ID de la cuenta temporal a actualizar
 * @param nuevoNombreUsuario Nuevo Nombre_Usuario_Temporal único
 * @returns boolean 'true' si se realizó la actualización correctamente
 */
export async function actualizarNombreUsuarioCuentaTemporal(
  idCuentaTemporal: number,
  nuevoNombreUsuario: string,
): Promise<boolean> {
  const sql = `
    UPDATE "T_Cuentas_Temporales"
    SET "Nombre_Usuario_Temporal" = $1
    WHERE "Id_Cuenta_Temporal" = $2
  `;

  const result = await query(sql, [nuevoNombreUsuario, idCuentaTemporal]);
  return (result.rowCount ?? 0) > 0;
}
