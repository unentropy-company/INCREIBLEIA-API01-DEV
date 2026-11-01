import { query } from "../../connectors/Postgres";

/**
 * Elimina una persona y sus empleos asociados dentro de una transacción SQL atómica.
 * Retorna la ruta de la foto de perfil (si tenía) para proceder a borrarla del bucket R2.
 */
export async function eliminarPersonaCascadaQuery(
  idPersona: string,
): Promise<{ rutaFoto: string | null } | null> {
  // Obtenemos la ruta de foto antes de borrar
  const resVerif = await query(
    `SELECT "Ruta_Foto" FROM "T_Personas" WHERE "Identificador_Persona" = $1 LIMIT 1;`,
    [idPersona],
  );

  if (resVerif.rowCount === 0) {
    return null;
  }

  const rutaFoto = resVerif.rows[0]?.Ruta_Foto || null;

  try {
    await query("BEGIN");

    // 1. Eliminar vínculos laborales en T_Empleados_Empresas
    await query(`DELETE FROM "T_Empleados_Empresas" WHERE "Id_Persona" = $1;`, [
      idPersona,
    ]);

    // 2. Eliminar la persona en T_Personas
    await query(
      `DELETE FROM "T_Personas" WHERE "Identificador_Persona" = $1;`,
      [idPersona],
    );

    await query("COMMIT");

    return { rutaFoto };
  } catch (error) {
    await query("ROLLBACK");
    throw error;
  }
}
