import { query } from "../../connectors/Postgres";

export interface DetallePersonaDbRow {
  Identificador_Persona: string;
  Nombres: string;
  Apellidos: string;
  Celular: string | null;
  Correo: string | null;
  Ruta_Foto: string | null;
  Fecha_Registro: string;
  Fecha_Actualizacion: string | null;
  Id_Empleado_Empresa: number | null;
  Id_Empresa: number | null;
  RUC: string | null;
  Razon_Social: string | null;
  Cargo_Empleado: string | null;
  Correo_Corporativo_Empleado: string | null;
  Fecha_Asignacion: string | null;
}

/**
 * Consulta los datos personales de la persona (incluyendo fechas de auditoría)
 * y su empleo activo actual (si existe).
 */
export async function obtenerDetallePersonaPorId(
  idPersona: string,
): Promise<DetallePersonaDbRow | null> {
  const sql = `
    SELECT
      p."Identificador_Persona",
      p."Nombres",
      p."Apellidos",
      p."Celular",
      p."Correo",
      p."Ruta_Foto",
      TO_CHAR(p."Fecha_Registro", 'YYYY-MM-DD') AS "Fecha_Registro",
      TO_CHAR(p."Fecha_Actualizacion", 'YYYY-MM-DD') AS "Fecha_Actualizacion",
      emp_actual."Id_Empleado_Empresa",
      emp_actual."Id_Empresa",
      emp_actual."RUC",
      emp_actual."Razon_Social",
      emp_actual."Cargo_Empleado",
      emp_actual."Correo_Corporativo_Empleado",
      TO_CHAR(emp_actual."Fecha_Asignacion", 'YYYY-MM-DD') AS "Fecha_Asignacion"
    FROM "T_Personas" p
    LEFT JOIN LATERAL (
      SELECT
        ee."Id_Empleado_Empresa",
        e."Id_Empresa",
        e."RUC",
        e."Razon_Social",
        ee."Cargo_Empleado",
        ee."Correo_Corporativo_Empleado",
        ee."Fecha_Asignacion"
      FROM "T_Empleados_Empresas" ee
      INNER JOIN "T_Empresas" e ON e."Id_Empresa" = ee."Id_Empresa"
      WHERE ee."Id_Persona" = p."Identificador_Persona"
        AND ee."Fecha_Fin_Asignacion" IS NULL
      ORDER BY ee."Fecha_Asignacion" DESC NULLS LAST, ee."Id_Empleado_Empresa" DESC
      LIMIT 1
    ) emp_actual ON TRUE
    WHERE p."Identificador_Persona" = $1;
  `;

  const result = await query(sql, [idPersona]);
  return result.rows[0] || null;
}