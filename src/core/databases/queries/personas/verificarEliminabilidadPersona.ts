import { query } from "../../connectors/Postgres";

export interface MetricasEliminacionPersonaDB {
  Nombres: string;
  Apellidos: string;
  Certificados_Emitidos: number;
  Capacitaciones_Asociadas: number;
  Empleos_En_Historial: number;
  Capacitaciones_Pendientes: number;
  Capacitaciones_Iniciadas_O_Finalizadas: number;
}

/**
 * Consulta en un solo viaje a PostgreSQL todas las métricas de integridad referencial
 * de una persona para determinar si puede ser eliminada.
 */
export async function verificarEliminabilidadPersonaQuery(
  idPersona: string,
): Promise<MetricasEliminacionPersonaDB | null> {
  const sql = `
    SELECT 
      p."Nombres",
      p."Apellidos",

      -- 1. Total Certificados Emitidos (Tanto como Persona Natural como por Empresa)
      (
        SELECT COUNT(DISTINCT cert."Id_Certificado")::INT
        FROM "T_Certificados" cert
        LEFT JOIN "T_Capacitacion_Persona_Natural" cpn 
          ON cpn."Id_Capacitacion_Persona_Natural" = cert."Id_Capacitacion_Persona_Natural"
        LEFT JOIN "T_Capacitaciones_Por_Empresa" cpe 
          ON cpe."Id_Capacitacion_Empresa" = cert."Id_Capacitacion_Por_Empresa"
        LEFT JOIN "T_Capacitacion_Empleado_Empresa" cee 
          ON cee."Id_Capacitacion_Empresa" = cpe."Id_Capacitacion_Empresa"
        LEFT JOIN "T_Empleados_Empresas" ee 
          ON ee."Id_Empleado_Empresa" = cee."Id_Empleado_Empresa"
        WHERE cpn."Identificador_Persona" = p."Identificador_Persona" 
           OR ee."Id_Persona" = p."Identificador_Persona"
      ) AS "Certificados_Emitidos",

      -- 2. Total de Empleos en su Historial
      (
        SELECT COUNT(*)::INT 
        FROM "T_Empleados_Empresas" 
        WHERE "Id_Persona" = p."Identificador_Persona"
      ) AS "Empleos_En_Historial",

      -- 3. Total de Capacitaciones Asociadas
      (
        SELECT COUNT(DISTINCT clases_unificadas."Id_Clase")::INT
        FROM (
          -- Vía Persona Natural
          SELECT cl."Id_Clase"
          FROM "T_Capacitacion_Persona_Natural" cpn
          INNER JOIN "T_Capacitacion_Varias_Personas_Naturales" cvpn 
            ON cvpn."Id_Capacitacion_Personas_Naturales" = cpn."Id_Capacitacion_Varias_Personas_Naturales"
          -- Se asume el enlace con clases o directo
          CROSS JOIN "T_Clases" cl
          WHERE cpn."Identificador_Persona" = p."Identificador_Persona"

          UNION

          -- Vía Empleado Empresa
          SELECT cpe."Id_Clase"
          FROM "T_Capacitacion_Empleado_Empresa" cee
          INNER JOIN "T_Capacitaciones_Por_Empresa" cpe 
            ON cpe."Id_Capacitacion_Empresa" = cee."Id_Capacitacion_Empresa"
          INNER JOIN "T_Empleados_Empresas" ee 
            ON ee."Id_Empleado_Empresa" = cee."Id_Empleado_Empresa"
          WHERE ee."Id_Persona" = p."Identificador_Persona"
        ) AS clases_unificadas
      ) AS "Capacitaciones_Asociadas",

      -- 4. Capacitaciones Pendientes (Estado = 'P')
      (
        SELECT COUNT(DISTINCT cl."Id_Clase")::INT
        FROM "T_Clases" cl
        INNER JOIN "T_Capacitaciones_Por_Empresa" cpe ON cpe."Id_Clase" = cl."Id_Clase"
        INNER JOIN "T_Capacitacion_Empleado_Empresa" cee ON cee."Id_Capacitacion_Empresa" = cpe."Id_Capacitacion_Empresa"
        INNER JOIN "T_Empleados_Empresas" ee ON ee."Id_Empleado_Empresa" = cee."Id_Empleado_Empresa"
        WHERE ee."Id_Persona" = p."Identificador_Persona" AND cl."Estado_Clase" = 'P'
      ) AS "Capacitaciones_Pendientes",

      -- 5. Capacitaciones Iniciadas o Concluidas (EE, EC, EF, F)
      (
        SELECT COUNT(DISTINCT cl."Id_Clase")::INT
        FROM "T_Clases" cl
        INNER JOIN "T_Capacitaciones_Por_Empresa" cpe ON cpe."Id_Clase" = cl."Id_Clase"
        INNER JOIN "T_Capacitacion_Empleado_Empresa" cee ON cee."Id_Capacitacion_Empresa" = cpe."Id_Capacitacion_Empresa"
        INNER JOIN "T_Empleados_Empresas" ee ON ee."Id_Empleado_Empresa" = cee."Id_Empleado_Empresa"
        WHERE ee."Id_Persona" = p."Identificador_Persona" AND cl."Estado_Clase" IN ('EE', 'EC', 'EF', 'F')
      ) AS "Capacitaciones_Iniciadas_O_Finalizadas"

    FROM "T_Personas" p
    WHERE p."Identificador_Persona" = $1
    LIMIT 1;
  `;

  const result = await query(sql, [idPersona]);
  return result.rows[0] || null;
}