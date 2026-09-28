import { query } from "../../connectors/Postgres";
import { EmpresaSelectorItem } from "../../../../interfaces/shared/apis/api01/empresas/types";

export interface SelectorEmpresasDbResult {
  totalPersonasSinEmpresa: number;
  totalFiltrados: number;
  empresas: EmpresaSelectorItem[];
}

export async function obtenerEmpresasParaSelector(
  filtroBusqueda: string | undefined,
  limite: number,
  offset: number,
): Promise<SelectorEmpresasDbResult> {
  const params: any[] = [];
  let searchCondition = "";

  if (filtroBusqueda && filtroBusqueda.trim() !== "") {
    params.push(`%${filtroBusqueda.trim()}%`);
    searchCondition = `
      WHERE e."RUC" ILIKE $${params.length} 
         OR e."Razon_Social" ILIKE $${params.length}
    `;
  }

  params.push(limite);
  const paramLimit = `$${params.length}`;
  params.push(offset);
  const paramOffset = `$${params.length}`;

  const sql = `
    WITH personas_sin_empresa AS (
      SELECT COUNT(*)::INT AS total
      FROM "T_Personas" p
      WHERE NOT EXISTS (
        SELECT 1
        FROM "T_Empleados_Empresas" ee
        WHERE ee."Id_Persona" = p."Identificador_Persona"
          AND ee."Fecha_Fin_Asignacion" IS NULL
      )
    ),
    empresas_filtradas AS (
      SELECT 
        e."Id_Empresa",
        e."RUC",
        e."Razon_Social"
      FROM "T_Empresas" e
      ${searchCondition}
    ),
    conteo_empresas AS (
      SELECT COUNT(*)::INT AS total FROM empresas_filtradas
    ),
    empresas_paginadas AS (
      SELECT * FROM empresas_filtradas
      ORDER BY "Razon_Social" ASC
      LIMIT ${paramLimit} OFFSET ${paramOffset}
    ),
    empleados_activos_por_empresa AS (
      SELECT 
        ee."Id_Empresa",
        COUNT(DISTINCT ee."Id_Persona")::INT AS total_empleados
      FROM "T_Empleados_Empresas" ee
      WHERE ee."Fecha_Fin_Asignacion" IS NULL
      GROUP BY ee."Id_Empresa"
    )
    SELECT 
      ep."Id_Empresa",
      ep."RUC",
      ep."Razon_Social",
      COALESCE(eape.total_empleados, 0)::INT AS "Cantidad_Empleados_Actuales",
      pse.total AS "Total_Personas_Sin_Empresa",
      ce.total AS "Total_Filtrados"
    FROM empresas_paginadas ep
    CROSS JOIN personas_sin_empresa pse
    CROSS JOIN conteo_empresas ce
    LEFT JOIN empleados_activos_por_empresa eape ON eape."Id_Empresa" = ep."Id_Empresa"
    ORDER BY ep."Razon_Social" ASC;
  `;

  const result = await query(sql, params);

  if (result.rows.length === 0) {
    // Si la página supera el total de registros, consultamos conteos base
    const fallbackSql = `
      SELECT 
        (SELECT COUNT(*)::INT FROM "T_Personas" p WHERE NOT EXISTS (
          SELECT 1 FROM "T_Empleados_Empresas" ee WHERE ee."Id_Persona" = p."Identificador_Persona" AND ee."Fecha_Fin_Asignacion" IS NULL
        )) AS "Total_Personas_Sin_Empresa",
        (SELECT COUNT(*)::INT FROM "T_Empresas" e ${searchCondition}) AS "Total_Filtrados";
    `;
    const fallbackResult = await query(fallbackSql, searchCondition ? [`%${filtroBusqueda?.trim()}%`] : []);
    const row = fallbackResult.rows[0];
    return {
      totalPersonasSinEmpresa: row ? row.Total_Personas_Sin_Empresa : 0,
      totalFiltrados: row ? row.Total_Filtrados : 0,
      empresas: [],
    };
  }

  const totalPersonasSinEmpresa = result.rows[0].Total_Personas_Sin_Empresa;
  const totalFiltrados = result.rows[0].Total_Filtrados;

  const empresas: EmpresaSelectorItem[] = result.rows.map((row) => ({
    Id_Empresa: row.Id_Empresa,
    RUC: row.RUC,
    Razon_Social: row.Razon_Social,
    Cantidad_Empleados_Actuales: row.Cantidad_Empleados_Actuales,
  }));

  return {
    totalPersonasSinEmpresa,
    totalFiltrados,
    empresas,
  };
}