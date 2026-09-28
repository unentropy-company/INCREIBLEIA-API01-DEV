import { query } from "../../connectors/Postgres";
import { IndicadoresPersonasData } from "../../../../interfaces/shared/apis/api01/personas/types";

export async function obtenerIndicadoresPersonas(): Promise<IndicadoresPersonasData> {
  const sql = `
    SELECT
      COUNT(*)::INT AS "Total_Personas",
      COUNT(*) FILTER (
        WHERE NOT EXISTS (
          SELECT 1 
          FROM "T_Empleados_Empresas" ee
          WHERE ee."Id_Persona" = p."Identificador_Persona"
            AND ee."Fecha_Fin_Asignacion" IS NULL
        )
      )::INT AS "Total_Personas_Sin_Empresa"
    FROM "T_Personas" p;
  `;

  const result = await query(sql);
  const row = result.rows[0];

  return {
    Total_Personas: row ? row.Total_Personas : 0,
    Total_Personas_Sin_Empresa: row ? row.Total_Personas_Sin_Empresa : 0,
  };
}
