import { query } from "../../connectors/Postgres";

export interface EmpleoVigenteDB {
  Id_Empleado_Empresa: number;
  Id_Empresa: number;
  Cargo_Empleado: string | null;
  Correo_Corporativo_Empleado: string | null;
  RUC?: string;
  Razon_Social?: string;
  Fecha_Asignacion?: string;
}

/**
 * Valida conflictos para actualización:
 * - Correo personal único (excluyendo a la propia persona).
 * - Correo corporativo único entre empleados activos (excluyendo su empleo actual).
 */
export async function verificarConflictosActualizacionPersona(params: {
  idPersona: string;
  correoPersonal: string | null;
  correoCorporativo: string | null;
  idEmpleadoEmpresaActual: number | null;
}): Promise<{
  existeCorreoPersonal: boolean;
  existeCorreoCorporativoActivo: boolean;
}> {
  const sql = `
    SELECT 
      CASE 
        WHEN $2::VARCHAR IS NOT NULL THEN EXISTS(
          SELECT 1 FROM "T_Personas" 
          WHERE "Correo" = $2 AND "Identificador_Persona" <> $1
        )
        ELSE FALSE 
      END AS "existeCorreoPersonal",
      CASE 
        WHEN $3::VARCHAR IS NOT NULL THEN EXISTS(
          SELECT 1 FROM "T_Empleados_Empresas" 
          WHERE "Correo_Corporativo_Empleado" = $3 
            AND "Fecha_Fin_Asignacion" IS NULL
            AND ($4::INT IS NULL OR "Id_Empleado_Empresa" <> $4)
        )
        ELSE FALSE 
      END AS "existeCorreoCorporativoActivo";
  `;

  const result = await query(sql, [
    params.idPersona,
    params.correoPersonal,
    params.correoCorporativo,
    params.idEmpleadoEmpresaActual,
  ]);

  const row = result.rows[0];
  return {
    existeCorreoPersonal: Boolean(row?.existeCorreoPersonal),
    existeCorreoCorporativoActivo: Boolean(row?.existeCorreoCorporativoActivo),
  };
}

/**
 * Obtiene el empleo activo vigente actual de la persona con datos de la empresa
 */
export async function obtenerEmpleoActivoPersona(
  idPersona: string,
): Promise<EmpleoVigenteDB | null> {
  const sql = `
    SELECT 
      ee."Id_Empleado_Empresa",
      ee."Id_Empresa",
      ee."Cargo_Empleado",
      ee."Correo_Corporativo_Empleado",
      e."RUC",
      e."Razon_Social",
      ee."Fecha_Asignacion"::TEXT AS "Fecha_Asignacion"
    FROM "T_Empleados_Empresas" ee
    INNER JOIN "T_Empresas" e ON e."Id_Empresa" = ee."Id_Empresa"
    WHERE ee."Id_Persona" = $1 AND ee."Fecha_Fin_Asignacion" IS NULL
    LIMIT 1;
  `;
  const result = await query(sql, [idPersona]);
  return result.rows[0] || null;
}

/**
 * Obtiene la información completa de un empleo por su ID (incluyendo RUC y Razón Social)
 */
export async function obtenerDetalleEmpleoPorId(
  idEmpleadoEmpresa: number,
): Promise<EmpleoVigenteDB | null> {
  const sql = `
    SELECT 
      ee."Id_Empleado_Empresa",
      ee."Id_Empresa",
      ee."Cargo_Empleado",
      ee."Correo_Corporativo_Empleado",
      e."RUC",
      e."Razon_Social",
      ee."Fecha_Asignacion"::TEXT AS "Fecha_Asignacion"
    FROM "T_Empleados_Empresas" ee
    INNER JOIN "T_Empresas" e ON e."Id_Empresa" = ee."Id_Empresa"
    WHERE ee."Id_Empleado_Empresa" = $1
    LIMIT 1;
  `;
  const result = await query(sql, [idEmpleadoEmpresa]);
  return result.rows[0] || null;
}

/**
 * Actualiza los datos de la tabla T_Personas utilizando el timestamp
 * generado al momento en que la request llega al servidor Node.js.
 */
export async function actualizarDatosPersona(params: {
  idPersona: string;
  nombres: string;
  apellidos: string;
  celular: string | null;
  correo: string | null;
  rutaFoto?: string | null;
  fechaActualizacion?: string;
}): Promise<string> {
  const timestampServidor =
    params.fechaActualizacion || new Date().toISOString();

  const campos: string[] = [
    `"Nombres" = $2`,
    `"Apellidos" = $3`,
    `"Celular" = $4`,
    `"Correo" = $5`,
    `"Fecha_Actualizacion" = $6::TIMESTAMPTZ`,
  ];

  const values: any[] = [
    params.idPersona,
    params.nombres,
    params.apellidos,
    params.celular,
    params.correo,
    timestampServidor,
  ];

  if (params.rutaFoto !== undefined) {
    values.push(params.rutaFoto);
    campos.push(`"Ruta_Foto" = $${values.length}`);
  }

  const sql = `
    UPDATE "T_Personas"
    SET ${campos.join(", ")}
    WHERE "Identificador_Persona" = $1
    RETURNING "Fecha_Actualizacion";
  `;

  const result = await query(sql, values);
  return result.rows[0]?.Fecha_Actualizacion || timestampServidor;
}

/**
 * Cierra un empleo vigente colocando Fecha_Fin_Asignacion = CURRENT_DATE
 */
export async function finalizarEmpleoActivo(
  idEmpleadoEmpresa: number,
): Promise<void> {
  const sql = `
    UPDATE "T_Empleados_Empresas"
    SET "Fecha_Fin_Asignacion" = CURRENT_DATE
    WHERE "Id_Empleado_Empresa" = $1;
  `;
  await query(sql, [idEmpleadoEmpresa]);
}

/**
 * Actualiza cargo o correo corporativo sobre el mismo empleo activo
 */
export async function actualizarDetallesEmpleoActivo(params: {
  idEmpleadoEmpresa: number;
  cargo: string | null;
  correoCorporativo: string | null;
}): Promise<void> {
  const sql = `
    UPDATE "T_Empleados_Empresas"
    SET 
      "Cargo_Empleado" = $2,
      "Correo_Corporativo_Empleado" = $3
    WHERE "Id_Empleado_Empresa" = $1;
  `;
  await query(sql, [
    params.idEmpleadoEmpresa,
    params.cargo,
    params.correoCorporativo,
  ]);
}
