import { query } from "../../connectors/Postgres";

export enum TiposDocumentosIdentidad {
  DNI = 1,
  CARNET_EXTRANJERIA = 2,
  PASAPORTE = 3,
}

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

function obtenerNombreTipoDocumento(idTipo: number): string {
  switch (idTipo) {
    case TiposDocumentosIdentidad.DNI:
      return "DNI";
    case TiposDocumentosIdentidad.CARNET_EXTRANJERIA:
      return "Carnet de Extranjería";
    case TiposDocumentosIdentidad.PASAPORTE:
      return "Pasaporte";
    default:
      return "Documento de Identidad";
  }
}

/**
 * Consulta las métricas de integridad referencial de una persona.
 * Extrae Numero_Documento y Tipo_Documento directamente del Identificador_Persona (ej. '71986445-1')
 * evitando joins a tablas inexistentes.
 */
export async function verificarEliminabilidadPersonaQuery(
  idPersona: string,
): Promise<MetricasEliminacionPersonaDB | null> {
  const sql = `
    SELECT 
      p."Nombres",
      p."Apellidos",

      -- Extracción del número y tipo a partir del Identificador compuesto (ej. 71986445-1)
      SPLIT_PART(p."Identificador_Persona", '-', 1) AS "Numero_Documento",
      COALESCE(NULLIF(SPLIT_PART(p."Identificador_Persona", '-', 2), '')::INT, 1) AS "Tipo_Documento_Id",

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
  const row = result.rows[0];

  if (!row) {
    return null;
  }

  const idTipoDoc =
    Number(row.Tipo_Documento_Id) || TiposDocumentosIdentidad.DNI;

  return {
    Nombres: row.Nombres,
    Apellidos: row.Apellidos,
    Tipo_Documento_Id: idTipoDoc,
    Tipo_Documento_Nombre: obtenerNombreTipoDocumento(idTipoDoc),
    Numero_Documento: row.Numero_Documento,
    Certificados_Emitidos: Number(row.Certificados_Emitidos) || 0,
    Capacitaciones_Asociadas: Number(row.Capacitaciones_Asociadas) || 0,
    Empleos_En_Historial: Number(row.Empleos_En_Historial) || 0,
    Capacitaciones_Pendientes: Number(row.Capacitaciones_Pendientes) || 0,
    Capacitaciones_Iniciadas_O_Finalizadas:
      Number(row.Capacitaciones_Iniciadas_O_Finalizadas) || 0,
  };
}
