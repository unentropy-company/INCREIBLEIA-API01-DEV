// src/core/database/connectors/postgres.ts
import { Pool, QueryResult, QueryResultRow, PoolClient } from "pg";
import dotenv from "dotenv";
import {
  PG_CONNECTION_TIMEOUT,
  PG_IDLE_TIMEOUT,
  PG_MAX_CONNECTIONS,
  PG_STATEMENT_TIMEOUT,
} from "../../../constants/POSTGRES_CONFIG";

dotenv.config();

const connectionURL = process.env.RDP02_DATABASE_URL;

if (!connectionURL) {
  throw new Error(
    "La variable de entorno RDP02_DATABASE_URL no está configurada"
  );
}

/**
 * Pool único de conexiones hacia la base de datos Neon.
 * Se crea una sola vez y se reutiliza en toda la aplicación (patrón singleton).
 */
let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;

  pool = new Pool({
    connectionString: connectionURL,
    max: parseInt(PG_MAX_CONNECTIONS, 10),
    idleTimeoutMillis: parseInt(PG_IDLE_TIMEOUT, 10),
    connectionTimeoutMillis: parseInt(PG_CONNECTION_TIMEOUT, 10),
    statement_timeout: parseInt(PG_STATEMENT_TIMEOUT, 10),
    ssl: { rejectUnauthorized: true }, // Neon requiere SSL siempre
  });

  // Manejador de errores a nivel de pool (evita que un error no controlado
  // en una conexión inactiva tumbe el proceso completo de Node)
  pool.on("error", (err) => {
    console.error("Error inesperado en el pool de PostgreSQL:", err);
  });

  return pool;
}

/**
 * Ejecuta una consulta SQL contra la base de datos
 * @param text Consulta SQL parametrizada
 * @param params Parámetros de la consulta
 * @returns Resultado de la consulta
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params: any[] = []
): Promise<QueryResult<T>> {
  const client = await getPool().connect();

  try {
    const start = Date.now();

    const result = await client.query<T>(text, params);

    if (process.env.ENTORNO === "D") {
      const duration = Date.now() - start;
      console.log("Query ejecutada", {
        text: text.substring(0, 80) + (text.length > 80 ? "..." : ""),
        duration,
        filas: result.rowCount,
      });
    }

    return result;
  } catch (error) {
    console.error("Error ejecutando consulta:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Ejecuta una transacción en la base de datos
 * @param callback Función que contiene las operaciones de la transacción,
 * recibe un cliente de PostgreSQL para ejecutar las queries dentro de la transacción
 * @returns Resultado de la transacción
 */
export async function transaction<T = any>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  let clientReleased = false;

  try {
    await client.query("BEGIN");

    const result = await callback(client);

    await client.query("COMMIT");

    return result;
  } catch (error) {
    if (!clientReleased) {
      await client.query("ROLLBACK").catch((err) => {
        console.error("Error durante rollback:", err);
      });
    }

    console.error("Error en transacción:", error);
    throw error;
  } finally {
    if (!clientReleased) {
      client.release();
      clientReleased = true;
    }
  }
}

/**
 * Cliente de PostgreSQL con métodos convenientes para lectura, escritura y transacciones
 */
export const postgresClient = {
  /**
   * Ejecuta una consulta de lectura
   */
  read: async <T extends QueryResultRow = any>(
    text: string,
    params: any[] = []
  ): Promise<QueryResult<T>> => {
    return await query<T>(text, params);
  },

  /**
   * Ejecuta una consulta de escritura
   */
  write: async <T extends QueryResultRow = any>(
    text: string,
    params: any[] = []
  ): Promise<QueryResult<T>> => {
    return await query<T>(text, params);
  },

  /**
   * Ejecuta una transacción
   */
  transaction: async <T = any>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> => {
    return await transaction<T>(callback);
  },

  /**
   * Cierra el pool de conexiones (usar en shutdown graceful del servidor)
   */
  closeConnection: async (): Promise<void> => {
    await closePool();
  },
};

/**
 * Cierra el pool de conexiones
 */
export async function closePool(): Promise<void> {
  if (!pool) return;

  try {
    await pool.end();
    console.log("Pool de conexiones cerrado correctamente");
  } catch (error) {
    console.error("Error al cerrar el pool:", error);
  } finally {
    pool = null;
  }
}