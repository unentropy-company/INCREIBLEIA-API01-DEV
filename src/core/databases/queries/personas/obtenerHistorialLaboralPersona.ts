import { query } from "../../connectors/Postgres";
import { EstadoDeEmpleo } from "../../../../interfaces/shared/EstadoLaboral";
import { ItemHistorialLaboral } from "../../../../interfaces/shared/apis/api01/personas/[identificadorPersona]/types";

export interface HistorialLaboralDbResult {
  totalRegistros: number;
  items: ItemHistorialLaboral[];
}

export async function obtenerHistorialLaboralPersona(
  idPersona: string,
  limite: number,
  offset: number,
): Promise<HistorialLaboralDbResult> {
  const sql = `
    WITH conteo_total AS (
      SELECT COUNT(*)::INT AS total
      FROM "T_Empleados_Empresas"
      WHERE "Id_Persona" = $1
    ),
    historial_paginado AS (
      SELECT
        ee."Id_Empleado_Empresa",
        ee."Cargo_Empleado",
        TO_CHAR(ee."Fecha_Asignacion", 'YYYY-MM-DD') AS "Fecha_Inicio",
        TO_CHAR(ee."Fecha_Fin_Asignacion", 'YYYY-MM-DD') AS "Fecha_Fin",
        CASE
          WHEN ee."Fecha_Fin_Asignacion" IS NULL THEN '${EstadoDeEmpleo.VIGENTE}'
          ELSE '${EstadoDeEmpleo.CERRADO}'
        END AS "Estado",
        e."Id_Empresa",
        e."RUC",
        e."Razon_Social"
      FROM "T_Empleados_Empresas" ee
      INNER JOIN "T_Empresas" e ON e."Id_Empresa" = ee."Id_Empresa"
      WHERE ee."Id_Persona" = $1
      ORDER BY ee."Fecha_Asignacion" DESC NULLS LAST, ee."Id_Empleado_Empresa" DESC
      LIMIT $2 OFFSET $3
    )
    SELECT
      hp.*,
      ct.total AS "Total_Registros"
    FROM historial_paginado hp
    CROSS JOIN conteo_total ct;
  `;

  const result = await query(sql, [idPersona, limite, offset]);

  if (result.rows.length === 0) {
    const totalCountRes = await query(
      `SELECT COUNT(*)::INT AS total FROM "T_Empleados_Empresas" WHERE "Id_Persona" = $1;`,
      [idPersona],
    );
    return {
      totalRegistros: totalCountRes.rows[0]?.total || 0,
      items: [],
    };
  }

  const items: ItemHistorialLaboral[] = result.rows.map((row) => {
    const inicioStr = row.Fecha_Inicio || "Inicio no especificado";
    const finStr = row.Fecha_Fin ? row.Fecha_Fin : "Actual";
    const periodoTexto = `${inicioStr} — ${finStr}`;

    return {
      Id_Empleado_Empresa: row.Id_Empleado_Empresa,
      Cargo: row.Cargo_Empleado || "Cargo no Especificado",
      Fecha_Inicio: row.Fecha_Inicio,
      Fecha_Fin: row.Fecha_Fin,
      Periodo_Texto: periodoTexto,
      Estado: row.Estado as EstadoDeEmpleo,
      Empresa: {
        Id_Empresa: row.Id_Empresa,
        RUC: row.RUC,
        Razon_Social: row.Razon_Social,
      },
    };
  });

  return {
    totalRegistros: result.rows[0].Total_Registros,
    items,
  };
}