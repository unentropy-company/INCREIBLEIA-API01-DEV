import { query } from "../../connectors/Postgres";

export interface MetricasEliminacionPersonaDB {
  Nombres: string;
  Apellidos: string;
  Tipo_Documento_Id: number;
  Tipo_Documento_Nombre: string;
  Numero_Documento: string;
  Certificados_Emitidos: number;
  Capacitaciones_Asociadas: number;
  Empleos_En_Historial: number;
  Capacitaciones_Pendientes: number;
  Capacitaciones_Iniciadas_O_Finalizadas: number;
}

export async function verificarEliminabilidadPersonaQuery(
  idPersona: string,
): Promise<MetricasEliminacionPersonaDB | null> {
  const sql = `
    SELECT 
      p."Nombres",
      p."Apellidos",
      p."Id_Tipo_Documento" AS "Tipo_Documento_Id",
      td."Nombre_Tipo_Documento" AS "Tipo_Documento_Nombre",
      p."Numero_Documento",

      -- 1. Total Certificados Emitidos
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

      -- 2. Total Empleos en Historial
      (
        SELECT COUNT(*)::INT 
        FROM "T_Empleados_Empresas" 
        WHERE "Id_Persona" = p."Identificador_Persona"
      ) AS "Empleos_En_Historial",

      -- 3. Total Capacitaciones Asociadas
      (
        SELECT COUNT(DISTINCT clases_unificadas."Id_Clase")::INT
        FROM (
          SELECT cl."Id_Clase"
          FROM "T_Capacitacion_Persona_Natural" cpn
          INNER JOIN "T_Capacitacion_Varias_Personas_Naturales" cvpn 
            ON cvpn."Id_Capacitacion_Personas_Naturales" = cpn."Id_Capacitacion_Varias_Personas_Naturales"
          CROSS JOIN "T_Clases" cl
          WHERE cpn."Identificador_Persona" = p."Identificador_Persona"

          UNION

          SELECT cpe."Id_Clase"
          FROM "T_Capacitacion_Empleado_Empresa" cee
          INNER JOIN "T_Capacitaciones_Por_Empresa" cpe 
            ON cpe."Id_Capacitacion_Empresa" = cee."Id_Capacitacion_Empresa"
          INNER JOIN "T_Empleados_Empresas" ee 
            ON ee."Id_Empleado_Empresa" = cee."Id_Empleado_Empresa"
          WHERE ee."Id_Persona" = p."Identificador_Persona"
        ) AS clases_unificadas
      ) AS "Capacitaciones_Asociadas",

      -- 4. Capacitaciones Pendientes
      (
        SELECT COUNT(DISTINCT cl."Id_Clase")::INT
        FROM "T_Clases" cl
        INNER JOIN "T_Capacitaciones_Por_Empresa" cpe ON cpe."Id_Clase" = cl."Id_Clase"
        INNER JOIN "T_Capacitacion_Empleado_Empresa" cee ON cee."Id_Capacitacion_Empresa" = cpe."Id_Capacitacion_Empresa"
        INNER JOIN "T_Empleados_Empresas" ee ON ee."Id_Empleado_Empresa" = cee."Id_Empleado_Empresa"
        WHERE ee."Id_Persona" = p."Identificador_Persona" AND cl."Estado_Clase" = 'P'
      ) AS "Capacitaciones_Pendientes",

      -- 5. Capacitaciones Iniciadas o Concluidas
      (
        SELECT COUNT(DISTINCT cl."Id_Clase")::INT
        FROM "T_Clases" cl
        INNER JOIN "T_Capacitaciones_Por_Empresa" cpe ON cpe."Id_Clase" = cl."Id_Clase"
        INNER JOIN "T_Capacitacion_Empleado_Empresa" cee ON cee."Id_Capacitacion_Empresa" = cpe."Id_Capacitacion_Empresa"
        INNER JOIN "T_Empleados_Empresas" ee ON ee."Id_Empleado_Empresa" = cee."Id_Empleado_Empresa"
        WHERE ee."Id_Persona" = p."Identificador_Persona" AND cl."Estado_Clase" IN ('EE', 'EC', 'EF', 'F')
      ) AS "Capacitaciones_Iniciadas_O_Finalizadas"

    FROM "T_Personas" p
    INNER JOIN "T_Tipos_Documentos" td ON td."Id_Tipo_Documento" = p."Id_Tipo_Documento"
    WHERE p."Identificador_Persona" = $1
    LIMIT 1;
  `;

  const result = await query(sql, [idPersona]);
  return result.rows[0] || null;
}
