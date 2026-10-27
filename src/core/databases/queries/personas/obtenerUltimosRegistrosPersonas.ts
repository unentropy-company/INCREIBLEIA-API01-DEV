import { query } from "../../connectors/Postgres";

export interface UltimoRegistroPersonaDbRow {
  Identificador_Persona: string;
  Nombres: string;
  Apellidos: string;
  Ruta_Foto: string | null;
  Fecha_Registro: string;
  Id_Empresa: number | null;
  Razon_Social: string | null;
}

export async function obtenerUltimosRegistrosPersonas(
  diasMaximos: number,
  limite: number,
): Promise<UltimoRegistroPersonaDbRow[]> {
  const sql = `
    SELECT
      p."Identificador_Persona",
      p."Nombres",
      p."Apellidos",
      p."Ruta_Foto",
      p."Fecha_Registro",
      emp_actual."Id_Empresa",
      emp_actual."Razon_Social"
    FROM "T_Personas" p
    LEFT JOIN LATERAL (
      SELECT 
        e."Id_Empresa",
        e."Razon_Social"
      FROM "T_Empleados_Empresas" ee
      INNER JOIN "T_Empresas" e ON e."Id_Empresa" = ee."Id_Empresa"
      WHERE ee."Id_Persona" = p."Identificador_Persona"
        AND ee."Fecha_Fin_Asignacion" IS NULL
      ORDER BY ee."Fecha_Asignacion" DESC NULLS LAST, ee."Id_Empleado_Empresa" DESC
      LIMIT 1
    ) emp_actual ON TRUE
    WHERE p."Fecha_Registro" >= (CURRENT_DATE - ($1 || ' days')::INTERVAL)
    ORDER BY p."Fecha_Registro" DESC, p."Identificador_Persona" DESC
    LIMIT $2;
  `;

  const result = await query(sql, [diasMaximos, limite]);
  return result.rows;
}
