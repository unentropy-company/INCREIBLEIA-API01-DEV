import { query } from "../../connectors/Postgres";

/**
 * Actualiza el Nombre_Usuario de un Administrador por su ID.
 * Si el nombre de usuario ya está registrado por otro usuario, PostgreSQL lanzará un
 * error de clave única (código 23505) que es capturado por la API.
 *
 * @param idAdministrador ID del administrador a actualizar
 * @param nuevoNombreUsuario Nuevo Nombre_Usuario único
 * @returns boolean 'true' si se realizó la actualización correctamente
 */
export async function actualizarNombreUsuarioAdministrador(
  idAdministrador: number,
  nuevoNombreUsuario: string,
): Promise<boolean> {
  const sql = `
    UPDATE "T_Administradores"
    SET "Nombre_Usuario" = $1
    WHERE "Id_Administrador" = $2
  `;

  const result = await query(sql, [nuevoNombreUsuario, idAdministrador]);
  return (result.rowCount ?? 0) > 0;
}
