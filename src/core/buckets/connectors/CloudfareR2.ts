import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import dotenv from "dotenv";
import {
  R2_BUCKET_NAME,
  R2_PRESIGNED_GET_URL_EXPIRATION_SECONDS,
  R2_PRESIGNED_PUT_URL_EXPIRATION_SECONDS,
} from "../../../constants/CLOUDFLARE_R2_CONFIG";

dotenv.config();

const RDP01_S3_API_URL = process.env.RDP01_S3_API_URL;
const RDP01_S3_ACCESS_KEY_ID = process.env.RDP01_S3_ACCESS_KEY_ID;
const RDP01_S3_SECRET_ACCESS_KEY = process.env.RDP01_S3_SECRET_ACCESS_KEY;

// RDP01_S3_API_TOKEN_VALUE no se usa en este cliente: las operaciones
// S3-compatibles de R2 se autentican solo con Access Key ID + Secret Access Key.
// Ese token de API queda disponible por si en el futuro necesitas llamar a la
// API nativa de Cloudflare (administración de buckets, reglas de lifecycle, etc.)
// en vez de la API S3-compatible.

if (
  !RDP01_S3_API_URL ||
  !RDP01_S3_ACCESS_KEY_ID ||
  !RDP01_S3_SECRET_ACCESS_KEY
) {
  throw new Error(
    "Las variables de entorno RDP01_S3_API_URL, RDP01_S3_ACCESS_KEY_ID y RDP01_S3_SECRET_ACCESS_KEY son obligatorias",
  );
}

if (!R2_BUCKET_NAME) {
  throw new Error("La variable de entorno RDP01_S3_BUCKET_NAME es obligatoria");
}

/**
 * Cliente para interactuar con Cloudflare R2 (almacenamiento de archivos).
 *
 * En la base de datos SOLO se guarda la ruta (key) del archivo dentro del bucket,
 * nunca metadatos adicionales como tamaño, tipo o URLs. Este cliente es el
 * encargado de traducir esa ruta en operaciones reales sobre R2: subir,
 * reemplazar, eliminar, verificar existencia y generar URLs prefirmadas
 * temporales para lectura o escritura directa desde el frontend.
 *
 * Patrón singleton: una sola instancia del cliente S3 para toda la app.
 */
class R2StorageClient {
  private static instance: R2StorageClient;
  private readonly client: S3Client;
  private readonly bucketName: string;

  private constructor() {
    this.bucketName = R2_BUCKET_NAME;

    this.client = new S3Client({
      region: "auto", // R2 no usa regiones reales, "auto" es el valor esperado
      endpoint: RDP01_S3_API_URL,
      credentials: {
        accessKeyId: RDP01_S3_ACCESS_KEY_ID as string,
        secretAccessKey: RDP01_S3_SECRET_ACCESS_KEY as string,
      },
    });
  }

  /**
   * Obtiene la instancia única del cliente R2 (patrón singleton)
   */
  public static getInstance(): R2StorageClient {
    if (!R2StorageClient.instance) {
      R2StorageClient.instance = new R2StorageClient();
    }
    return R2StorageClient.instance;
  }

  /**
   * Sube un archivo nuevo a R2 en la ruta especificada.
   * Si ya existe un archivo en esa misma ruta, este método lo SOBRESCRIBE
   * (R2/S3 no diferencia entre "crear" y "reemplazar": un PutObject en una
   * key existente simplemente la sobrescribe). Por eso `replaceFile` es
   * un alias de este mismo método, solo para dejar la intención más clara
   * en el código que lo invoca.
   *
   * @param ruta Ruta (key) donde se guardará el archivo dentro del bucket
   * (ej: "certificados/2026/CERT-0001.pdf")
   * @param contenido Contenido del archivo en buffer
   * @param contentType Tipo MIME del archivo (ej: "application/pdf")
   */
  public async uploadFile(
    ruta: string,
    contenido: Buffer,
    contentType: string,
  ): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: ruta,
          Body: contenido,
          ContentType: contentType,
        }),
      );
    } catch (error) {
      console.error(`Error al subir archivo en la ruta "${ruta}":`, error);
      throw new Error(`No se pudo subir el archivo: ${ruta}`);
    }
  }

  /**
   * Reemplaza un archivo existente en R2. Es un alias semántico de `uploadFile`
   * (ver el comentario de ese método para más detalle de por qué).
   *
   * @param ruta Ruta (key) del archivo a reemplazar
   * @param contenido Nuevo contenido del archivo
   * @param contentType Tipo MIME del nuevo archivo
   */
  public async replaceFile(
    ruta: string,
    contenido: Buffer,
    contentType: string,
  ): Promise<void> {
    return this.uploadFile(ruta, contenido, contentType);
  }

  /**
   * Elimina un archivo de R2 dada su ruta
   * @param ruta Ruta (key) del archivo a eliminar
   */
  public async deleteFile(ruta: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: ruta,
        }),
      );
    } catch (error) {
      console.error(`Error al eliminar archivo en la ruta "${ruta}":`, error);
      throw new Error(`No se pudo eliminar el archivo: ${ruta}`);
    }
  }

  /**
   * Elimina múltiples archivos de R2 en una sola operación (más eficiente
   * que llamar deleteFile en un loop). Útil, por ejemplo, al eliminar todas
   * las evidencias asociadas a una capacitación que se está borrando.
   *
   * @param rutas Lista de rutas (keys) a eliminar
   */
  public async deleteMultipleFiles(rutas: string[]): Promise<void> {
    if (rutas.length === 0) return;

    try {
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucketName,
          Delete: {
            Objects: rutas.map((ruta) => ({ Key: ruta })),
            Quiet: true,
          },
        }),
      );
    } catch (error) {
      console.error("Error al eliminar múltiples archivos:", error);
      throw new Error("No se pudieron eliminar uno o más archivos");
    }
  }

  /**
   * Verifica si un archivo existe en R2 sin descargarlo (usa HEAD, no GET)
   * @param ruta Ruta (key) del archivo a verificar
   * @returns true si el archivo existe, false si no
   */
  public async fileExists(ruta: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: ruta,
        }),
      );
      return true;
    } catch (error: any) {
      // Si el error es "NotFound" o 404, simplemente no existe (no es un error real)
      if (
        error?.name === "NotFound" ||
        error?.$metadata?.httpStatusCode === 404
      ) {
        return false;
      }

      console.error(`Error al verificar existencia de "${ruta}":`, error);
      throw new Error(
        `No se pudo verificar la existencia del archivo: ${ruta}`,
      );
    }
  }

  /**
   * Genera una URL prefirmada TEMPORAL para DESCARGAR/VISUALIZAR un archivo.
   * La duración está atada a la constante R2_PRESIGNED_GET_URL_EXPIRATION_SECONDS
   * por defecto, pero puede sobreescribirse puntualmente si algún caso de uso
   * lo requiere (ej: un enlace de verificación pública que dure más tiempo).
   *
   * @param ruta Ruta (key) del archivo dentro del bucket
   * @param expiresInSeconds Duración personalizada en segundos (opcional)
   * @returns URL firmada temporal para acceder al archivo
   */
  public async getPresignedDownloadUrl(
    ruta: string,
    expiresInSeconds: number = R2_PRESIGNED_GET_URL_EXPIRATION_SECONDS,
  ): Promise<string> {
    console.log(
      `Generando URL prefirmada de descarga para "${ruta}" con expiración de ${expiresInSeconds} segundos...`,
    );
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: ruta,
      });

      return await getSignedUrl(this.client, command, {
        expiresIn: expiresInSeconds,
      });
    } catch (error) {
      console.error(
        `Error al generar URL prefirmada de descarga para "${ruta}":`,
        error,
      );
      throw new Error(`No se pudo generar la URL de descarga para: ${ruta}`);
    }
  }

  /**
   * Genera una URL prefirmada TEMPORAL para SUBIR un archivo directamente
   * desde el cliente (frontend) hacia R2, sin pasar el archivo por el
   * servidor. Útil para archivos pesados como evidencias de capacitación.
   * La duración está atada a la constante R2_PRESIGNED_PUT_URL_EXPIRATION_SECONDS.
   *
   * @param ruta Ruta (key) donde se guardará el archivo dentro del bucket
   * @param contentType Tipo MIME esperado del archivo a subir
   * @param expiresInSeconds Duración personalizada en segundos (opcional)
   * @returns URL firmada temporal para subir el archivo (PUT)
   */
  public async getPresignedUploadUrl(
    ruta: string,
    contentType: string,
    expiresInSeconds: number = R2_PRESIGNED_PUT_URL_EXPIRATION_SECONDS,
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: ruta,
        ContentType: contentType,
      });

      return await getSignedUrl(this.client, command, {
        expiresIn: expiresInSeconds,
      });
    } catch (error) {
      console.error(
        `Error al generar URL prefirmada de subida para "${ruta}":`,
        error,
      );
      throw new Error(`No se pudo generar la URL de subida para: ${ruta}`);
    }
  }

  /**
   * Lista todos los archivos que coincidan con un prefijo de ruta.
   * Útil, por ejemplo, para listar todas las evidencias de una capacitación
   * específica (ej: prefix = "evidencias/capacitacion-123/")
   *
   * @param prefix Prefijo de ruta a buscar
   * @returns Lista de rutas (keys) encontradas
   */
  public async listFiles(prefix: string): Promise<string[]> {
    try {
      const result = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: prefix,
        }),
      );

      return (result.Contents || [])
        .map((obj) => obj.Key)
        .filter((key): key is string => Boolean(key));
    } catch (error) {
      console.error(
        `Error al listar archivos con el prefijo "${prefix}":`,
        error,
      );
      throw new Error(
        `No se pudieron listar los archivos con prefijo: ${prefix}`,
      );
    }
  }
}

export const r2StorageClient = R2StorageClient.getInstance();
