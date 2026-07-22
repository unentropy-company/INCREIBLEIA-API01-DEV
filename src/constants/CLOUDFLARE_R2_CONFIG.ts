/**
 * Configuración de Cloudflare R2 (almacenamiento de archivos)
 *
 * R2 es compatible con la API de S3, por eso usamos @aws-sdk/client-s3
 * apuntando al endpoint propio de Cloudflare en vez de AWS.
 */

// Nombre del bucket donde se almacenan todos los archivos de la plataforma
// (certificados PDF, evidencias de capacitación, fotos de perfil, etc.)
export const R2_BUCKET_NAME = process.env.RDP01_S3_BUCKET_NAME || "";

// Duración por defecto (segundos) de una URL prefirmada de DESCARGA/VISUALIZACIÓN.
// Se usa, por ejemplo, cuando el portal de verificación pública genera el link
// para ver un certificado. Modifica este único valor para ajustar la duración
// en toda la plataforma.
export const R2_PRESIGNED_GET_URL_EXPIRATION_SECONDS = parseInt(
  process.env.R2_PRESIGNED_GET_URL_EXPIRATION_SECONDS || "3600", // 1 hora
  10,
);

// Duración por defecto (segundos) de una URL prefirmada de SUBIDA.
// Se usa cuando el frontend necesita subir un archivo directamente a R2
// sin pasar por el servidor (por ejemplo, subir evidencias de capacitación
// pesadas). Más corta que la de descarga porque solo se usa una vez y de inmediato.
export const R2_PRESIGNED_PUT_URL_EXPIRATION_SECONDS = parseInt(
  process.env.R2_PRESIGNED_PUT_URL_EXPIRATION_SECONDS || "900", // 15 minutos
  10,
);
