import { query } from "../../connectors/Postgres";

export interface PersonaRegistradaDB {
  Identificador_Persona: string;
  Nombres: string;
  Apellidos: string;
  Celular: string | null;
  Correo: string | null;
  Ruta_Foto: string | null;
  Fecha_Registro: string;
}

export interface EmpleadoEmpresaRegistradoDB {
  Id_Empleado_Empresa: number;
  Cargo_Empleado: string | null;
  Correo_Corporativo_Empleado: string | null;
  Id_Empresa: number;
  Id_Persona: string;
  Fecha_Asignacion: string;
}

/**
 * Valida si existe una persona por Identificador o por Correo (si este último está presente)
 */
export async function verificarExistenciaPersona(
  identificador: string,
  correo: string | null,
): Promise<{ existeIdentificador: boolean; existeCorreo: boolean }> {
  const sql = `
    SELECT 
      EXISTS(SELECT 1 FROM "T_Personas" WHERE "Identificador_Persona" = $1) AS "existeIdentificador",
      CASE 
        WHEN $2::VARCHAR IS NOT NULL THEN EXISTS(SELECT 1 FROM "T_Personas" WHERE "Correo" = $2)
        ELSE FALSE 
      END AS "existeCorreo";
  `;
  const result = await query(sql, [identificador, correo]);
  const row = result.rows[0];

  return {
    existeIdentificador: Boolean(row?.existeIdentificador),
    existeCorreo: Boolean(row?.existeCorreo),
  };
}

/**
 * Verifica si existe una empresa por su ID
 */
export async function verificarExistenciaEmpresa(
  idEmpresa: number,
): Promise<boolean> {
  const sql = `
    SELECT EXISTS(
      SELECT 1 FROM "T_Empresas" WHERE "Id_Empresa" = $1
    ) AS "existe";
  `;
  const result = await query(sql, [idEmpresa]);
  return Boolean(result.rows[0]?.existe);
}

/**
 * Inserta el registro en T_Personas
 */
export async function insertarPersona(params: {
  identificador: string;
  nombres: string;
  apellidos: string;
  celular: string | null;
  correo: string | null;
  rutaFoto: string | null;
}): Promise<PersonaRegistradaDB> {
  const sql = `
    INSERT INTO "T_Personas" (
      "Identificador_Persona",
      "Nombres",
      "Apellidos",
      "Celular",
      "Correo",
      "Ruta_Foto",
      "Fecha_Registro",
      "Fecha_Actualizacion"
    ) VALUES (
      $1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP AT TIME ZONE 'UTC', NULL
    )
    RETURNING 
      "Identificador_Persona",
      "Nombres",
      "Apellidos",
      "Celular",
      "Correo",
      "Ruta_Foto",
      "Fecha_Registro";
  `;

  const values = [
    params.identificador,
    params.nombres,
    params.apellidos,
    params.celular,
    params.correo,
    params.rutaFoto,
  ];

  const result = await query(sql, values);
  return result.rows[0];
}

/**
 * Inserta la vinculación laboral en T_Empleados_Empresas
 */
export async function insertarEmpleadoEmpresa(params: {
  idEmpresa: number;
  idPersona: string;
  cargo: string | null;
  correoCorporativo: string | null;
}): Promise<EmpleadoEmpresaRegistradoDB> {
  const sql = `
    INSERT INTO "T_Empleados_Empresas" (
      "Id_Empresa",
      "Id_Persona",
      "Cargo_Empleado",
      "Correo_Corporativo_Empleado",
      "Fecha_Asignacion",
      "Fecha_Fin_Asignacion"
    ) VALUES (
      $1, $2, $3, $4, CURRENT_DATE, NULL
    )
    RETURNING 
      "Id_Empleado_Empresa",
      "Cargo_Empleado",
      "Correo_Corporativo_Empleado",
      "Id_Empresa",
      "Id_Persona",
      "Fecha_Asignacion";
  `;

  const values = [
    params.idEmpresa,
    params.idPersona,
    params.cargo,
    params.correoCorporativo,
  ];

  const result = await query(sql, values);
  return result.rows[0];
}

/**
 * Valida:
 * 1. Si existe una persona por Identificador.
 * 2. Si existe una persona por Correo Personal (si se envía).
 * 3. Si existe un empleo vigente con el mismo Correo Corporativo (si se envía y tiene Fecha_Fin_Asignacion IS NULL).
 */
export async function verificarExistenciaPersonaYEmplazamiento(
  identificador: string,
  correoPersonal: string | null,
  correoCorporativo: string | null,
): Promise<{
  existeIdentificador: boolean;
  existeCorreoPersonal: boolean;
  existeCorreoCorporativoActivo: boolean;
}> {
  const sql = `
    SELECT 
      EXISTS(
        SELECT 1 FROM "T_Personas" 
        WHERE "Identificador_Persona" = $1
      ) AS "existeIdentificador",
      CASE 
        WHEN $2::VARCHAR IS NOT NULL THEN EXISTS(
          SELECT 1 FROM "T_Personas" 
          WHERE "Correo" = $2
        )
        ELSE FALSE 
      END AS "existeCorreoPersonal",
      CASE 
        WHEN $3::VARCHAR IS NOT NULL THEN EXISTS(
          SELECT 1 FROM "T_Empleados_Empresas" 
          WHERE "Correo_Corporativo_Empleado" = $3
            AND "Fecha_Fin_Asignacion" IS NULL
        )
        ELSE FALSE 
      END AS "existeCorreoCorporativoActivo";
  `;

  const result = await query(sql, [
    identificador,
    correoPersonal,
    correoCorporativo,
  ]);
  const row = result.rows[0];

  return {
    existeIdentificador: Boolean(row?.existeIdentificador),
    existeCorreoPersonal: Boolean(row?.existeCorreoPersonal),
    existeCorreoCorporativoActivo: Boolean(row?.existeCorreoCorporativoActivo),
  };
}

/**
 * Operación compensatoria para eliminar la persona si ocurre algún error posterior
 */
export async function eliminarPersonaPorIdentificador(
  identificador: string,
): Promise<void> {
  const sql = `DELETE FROM "T_Personas" WHERE "Identificador_Persona" = $1;`;
  await query(sql, [identificador]);
}
