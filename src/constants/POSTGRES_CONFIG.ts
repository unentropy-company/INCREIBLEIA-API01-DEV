// src/constants/POSTGRES_CONFIG.ts

/**
 * Configuración del pool de conexiones a PostgreSQL (Neon)
 *
 * Neon suspende automáticamente el compute tras un periodo de inactividad
 * (por defecto ~5 min en el plan free). Esto significa que:
 * - No conviene mantener un pool grande de conexiones "calientes" sin uso.
 * - El primer query tras un periodo de inactividad puede tardar más (cold start),
 *   por eso el connectionTimeout debe ser generoso.
 * - idleTimeout bajo ayuda a liberar conexiones que ya no se usan, reduciendo
 *   la probabilidad de mantener el compute despierto innecesariamente.
 */

// Máximo de conexiones simultáneas en el pool.
// Neon (plan free/launch) soporta hasta 100-ish conexiones directas, pero
// para una app Node tradicional (no serverless/edge) 10 es un valor seguro
// y suficiente para la mayoría de cargas sin agotar el límite del plan.
export const PG_MAX_CONNECTIONS = process.env.PG_MAX_CONNECTIONS || "10";

// Tiempo (ms) que una conexión puede estar inactiva en el pool antes de cerrarse.
// Se mantiene bajo para no retener conexiones abiertas sin necesidad.
export const PG_IDLE_TIMEOUT = process.env.PG_IDLE_TIMEOUT || "10000"; // 10s

// Tiempo (ms) máximo de espera para establecer una nueva conexión.
// Más alto de lo normal porque Neon puede tardar en "despertar" el compute
// si estuvo suspendido (cold start puede tomar 1-2s adicionales).
export const PG_CONNECTION_TIMEOUT =
  process.env.PG_CONNECTION_TIMEOUT || "10000"; // 10s

// Tiempo (ms) máximo que una query puede ejecutarse antes de ser cancelada.
// Protege contra queries colgadas que agoten el pool.
export const PG_STATEMENT_TIMEOUT = process.env.PG_STATEMENT_TIMEOUT || "15000"; // 15s
