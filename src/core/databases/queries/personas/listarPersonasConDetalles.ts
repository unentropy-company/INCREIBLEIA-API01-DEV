import { TiposDocumentosIdentidad } from "../../../../interfaces/shared/TiposDocumentosIdentidad";
import { ANIOS_VIGENCIA_CERTIFICADO } from "../../../../constants/CERTIFICADOS_CONFIG";
import { query } from "../../connectors/Postgres";

export interface FiltrosListadoPersonas {
  search?: string;
  idEmpresa?: number;
  tipoDocumento?: TiposDocumentosIdentidad;
  tieneCertificados?: boolean;
  limite: number;
  offset: number;
}

export interface PersonaDbRow {
  Identificador_Persona: string;
  Nombres: string;
  Apellidos: string;
  Ruta_Foto: string | null;
  Id_Empresa: number | null;
  Razon_Social: string | null;
  Certificados_Vigentes: number;
  Certificados_Vencidos: number;
}

export async function listarPersonasConDetalles(
  filtros: FiltrosListadoPersonas,
): Promise<{ personas: PersonaDbRow[]; totalFiltrados: number }> {
  const {
    search,
    idEmpresa,
    tipoDocumento,
    tieneCertificados,
    limite,
    offset,
  } = filtros;

  // Se pasa la constante en años en la posición $1
  const params: any[] = [ANIOS_VIGENCIA_CERTIFICADO];
  const conditions: string[] = [];

  // 1. Filtro flexible por nombres, apellidos o número de documento
  if (search && search.trim() !== "") {
    params.push(`%${search.trim()}%`);
    conditions.push(`
      (
        (p."Nombres" || ' ' || p."Apellidos") ILIKE $${params.length}
        OR (p."Apellidos" || ' ' || p."Nombres") ILIKE $${params.length}
        OR p."Identificador_Persona" ILIKE $${params.length}
      )
    `);
  }

  // 2. Filtro exacto por sufijo del Identificador (-1, -2 o -3)
  if (tipoDocumento !== undefined) {
    params.push(`%-${tipoDocumento}`);
    conditions.push(`p."Identificador_Persona" LIKE $${params.length}`);
  }

  // 3. Filtro por Empresa Activa
  if (idEmpresa !== undefined) {
    params.push(idEmpresa);
    conditions.push(`(emp_actual."Id_Empresa" = $${params.length})`);
  }

  // 4. Filtro por Tenencia de Certificados
  if (tieneCertificados !== undefined) {
    if (tieneCertificados === true) {
      conditions.push(`(COALESCE(cert_calc.total_certs, 0) > 0)`);
    } else {
      conditions.push(`(COALESCE(cert_calc.total_certs, 0) = 0)`);
    }
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  params.push(limite);
  const paramLimit = `$${params.length}`;
  params.push(offset);
  const paramOffset = `$${params.length}`;

  const sql = `
    WITH personas_base AS (
      SELECT 
        p."Identificador_Persona",
        p."Nombres",
        p."Apellidos",
        p."Ruta_Foto",
        emp_actual."Id_Empresa",
        emp_actual."Razon_Social",
        COALESCE(cert_calc.vigentes, 0)::INT AS "Certificados_Vigentes",
        COALESCE(cert_calc.vencidos, 0)::INT AS "Certificados_Vencidos",
        COALESCE(cert_calc.total_certs, 0)::INT AS "Total_Certificados"
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
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (
            WHERE CURRENT_DATE <= (c_fechas."Fecha_Referencia" + ($1 || ' years')::INTERVAL)
          )::INT AS vigentes,
          COUNT(*) FILTER (
            WHERE CURRENT_DATE > (c_fechas."Fecha_Referencia" + ($1 || ' years')::INTERVAL)
          )::INT AS vencidos,
          COUNT(*)::INT AS total_certs
        FROM (
          SELECT cl."Fecha_Clase" AS "Fecha_Referencia"
          FROM "T_Empleados_Empresas" ee
          INNER JOIN "T_Capacitacion_Empleado_Empresa" cee ON cee."Id_Empleado_Empresa" = ee."Id_Empleado_Empresa"
          INNER JOIN "T_Capacitaciones_Por_Empresa" ce ON ce."Id_Capacitacion_Empresa" = cee."Id_Capacitacion_Empresa"
          INNER JOIN "T_Clases" cl ON cl."Id_Clase" = ce."Id_Clase"
          INNER JOIN "T_Certificados" cert ON cert."Id_Capacitacion_Por_Empresa" = ce."Id_Capacitacion_Empresa"
          WHERE ee."Id_Persona" = p."Identificador_Persona"

          UNION ALL

          SELECT CURRENT_DATE AS "Fecha_Referencia"
          FROM "T_Capacitacion_Persona_Natural" cpn
          INNER JOIN "T_Certificados" cert_pn ON cert_pn."Id_Capacitacion_Persona_Natural" = cpn."Id_Capacitacion_Persona_Natural"
          WHERE cpn."Identificador_Persona" = p."Identificador_Persona"
        ) c_fechas
      ) cert_calc ON TRUE
      ${whereClause}
    ),
    conteo_total AS (
      SELECT COUNT(*)::INT AS total FROM personas_base
    ),
    personas_paginadas AS (
      SELECT * FROM personas_base
      ORDER BY "Apellidos" ASC, "Nombres" ASC
      LIMIT ${paramLimit} OFFSET ${paramOffset}
    )
    SELECT
      pp."Identificador_Persona",
      pp."Nombres",
      pp."Apellidos",
      pp."Ruta_Foto",
      pp."Id_Empresa",
      pp."Razon_Social",
      pp."Certificados_Vigentes",
      pp."Certificados_Vencidos",
      ct.total AS "Total_Filtrados"
    FROM personas_paginadas pp
    CROSS JOIN conteo_total ct;
  `;

  const result = await query(sql, params);
  const totalFiltrados =
    result.rows.length > 0 ? result.rows[0].Total_Filtrados : 0;

  return {
    personas: result.rows,
    totalFiltrados,
  };
}