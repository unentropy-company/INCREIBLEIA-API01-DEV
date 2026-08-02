import { query } from "../../connectors/Postgres";

export interface ActualizarAdministradorInput {
  Nombres: string;
  Apellidos: string;
  Genero: string;
}

/**
 * Actualiza los datos personales básicos de un administrador por su ID
 * @param idAdministrador ID del administrador a actualizar
 * @param datos Objeto con los campos Nombres, Apellidos y Genero
 * @returns boolean indicando si se realizó la actualización correctamente
 */
export async function actualizarDatosPersonalesAdministrador(
  idAdministrador: number,
  datos: ActualizarAdministradorInput,
): Promise<boolean> {
  const sql = `
    UPDATE "T_Administradores"
    SET 
      "Nombres" = $1,
      "Apellidos" = $2,
      "Genero" = $3
    WHERE "Id_Administrador" = $4
  `;

  const result = await query(sql, [
    datos.Nombres,
    datos.Apellidos,
    datos.Genero,
    idAdministrador,
  ]);

  return (result.rowCount ?? 0) > 0;
}
