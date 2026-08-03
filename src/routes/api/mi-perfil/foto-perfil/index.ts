import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";

import {
  FileErrorTypes,
  SystemErrorTypes,
  UserErrorTypes,
} from "../../../../interfaces/shared/errors";
import { ErrorResponseAPIBase } from "../../../../interfaces/shared/apis/types";
import { TiposUsuario } from "../../../../interfaces/shared/TiposUsuario";
import { r2StorageClient } from "../../../../core/buckets/connectors/CloudfareR2";
import {
  ADMINISTRADORES_SESSION_EXPIRATION,
  CUENTAS_TEMPORALES_SESSION_EXPIRATION,
} from "../../../../constants/EXPIRACIONES_JWT";
import { ResponseSuccessActualizarFotoPerfil } from "../../../../interfaces/shared/apis/api01/mi-perfil/foto-perfil/types";
import { actualizarRutaFotoPerfilAdministrador } from "../../../../core/databases/queries/administradores/actualizarRutaFotoPerfilAdministrador";
import { actualizarRutaFotoPerfilCuentaTemporal } from "../../../../core/databases/queries/cuentas-temporales/actualizarRutaFotoPerfilCuentaTemporal";

const actualizarFotoPerfilRouter = Router();

// Configuración de Multer para almacenamiento en memoria (máximo 5MB)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Tipos MIME permitidos
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * @openapi
 * /mi-perfil/foto-perfil:
 *   put:
 *     summary: Actualizar foto de perfil
 *     description: Carga o reemplaza la foto de perfil del usuario autenticado (Administrador o Cuenta Temporal). Almacena el archivo en Cloudflare R2 y guarda la ruta en la base de datos.
 *     tags:
 *       - Mi Perfil
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - foto
 *             properties:
 *               foto:
 *                 type: string
 *                 format: binary
 *                 description: Archivo de imagen (JPEG, PNG, WEBP, máx 5MB)
 *     responses:
 *       200:
 *         description: Foto de perfil actualizada con éxito. Retorna la URL pre-firmada de lectura.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Foto de perfil actualizada exitosamente"
 *                 data:
 *                   type: object
 *                   properties:
 *                     Foto_Perfil_URL:
 *                       type: string
 *                       example: "https://r2-bucket.com/Fotos_Perfil/Administradores/A_1.png?X-Amz-Algorithm=..."
 *       400:
 *         description: Error de validación en el archivo (no enviado, tipo de archivo no permitido o excede los 5MB).
 *       401:
 *         description: No autorizado (Token inválido o expirado).
 *       404:
 *         description: Usuario no encontrado en la base de datos.
 *       500:
 *         description: Error interno en el servidor o falla al comunicarse con R2/DB.
 */
// ==========================================
//               CONTROLADOR
// ==========================================
actualizarFotoPerfilRouter.put(
  "/",
  (req: Request, res: Response, next: NextFunction) => {
    upload.single("foto")(req, res, (err: any) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          const errorResponse: ErrorResponseAPIBase = {
            success: false,
            message: "El archivo excede el tamaño máximo permitido de 5MB",
            errorType: FileErrorTypes.FILE_TOO_LARGE,
          };
          return res.status(400).json(errorResponse);
        }
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: "Error procesando el archivo recibido",
          errorType: FileErrorTypes.FILE_PROCESSING_FAILED,
        };
        return res.status(400).json(errorResponse);
      } else if (err) {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: "Error interno al cargar la imagen",
          errorType: SystemErrorTypes.UNKNOWN_ERROR,
        };
        return res.status(500).json(errorResponse);
      }
      next();
    });
  },
  (async (req: Request, res: Response) => {
    try {
      // Extracción segura soportando estructura directa o anidada en req.user
      const authUser =
        (req.user as any)?.user || (req.user as any)?.data || req.user;
      const userType = req.userType!;
      const file = req.file;

      // 1. Validar presencia del archivo
      if (!file) {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: "No se proporcionó ninguna imagen en la solicitud",
          errorType: FileErrorTypes.FILE_MISSING,
        };
        return res.status(400).json(errorResponse);
      }

      // 2. Validar tipo MIME permitido
      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message:
            "El archivo debe ser una imagen válida (formatos permitidos: JPEG, PNG, WEBP)",
          errorType: FileErrorTypes.INVALID_FILE_TYPE,
        };
        return res.status(400).json(errorResponse);
      }

      // 3. Extraer extensión original del archivo
      let fileExtension = path.extname(file.originalname).toLowerCase();
      if (!fileExtension) {
        if (file.mimetype === "image/png") fileExtension = ".png";
        else if (file.mimetype === "image/webp") fileExtension = ".webp";
        else fileExtension = ".jpg";
      }

      let r2Path = "";
      let isUpdatedInDb = false;

      // 4. Construir la ruta respetando las subcarpetas y el ID del usuario
      if (userType === TiposUsuario.Administrador) {
        const idAdmin = authUser?.Id_Administrador;

        if (!idAdmin) {
          const errorResponse: ErrorResponseAPIBase = {
            success: false,
            message:
              "No se pudo obtener el ID del administrador desde la sesión",
            errorType: UserErrorTypes.USER_NOT_FOUND,
          };
          return res.status(401).json(errorResponse);
        }

        r2Path = `Fotos_Perfil/Administradores/A_${idAdmin}${fileExtension}`;

        // Sube / reemplaza directamente en Cloudflare R2
        await r2StorageClient.uploadFile(r2Path, file.buffer, file.mimetype);

        // Actualiza la ruta en la base de datos
        isUpdatedInDb = await actualizarRutaFotoPerfilAdministrador(
          idAdmin,
          r2Path,
        );
      } else {
        const idCuentaTemp = authUser?.Id_Cuenta_Temporal;

        if (!idCuentaTemp) {
          const errorResponse: ErrorResponseAPIBase = {
            success: false,
            message:
              "No se pudo obtener el ID de la cuenta temporal desde la sesión",
            errorType: UserErrorTypes.USER_NOT_FOUND,
          };
          return res.status(401).json(errorResponse);
        }

        r2Path = `Fotos_Perfil/Cuenta_Temporales/CT_${idCuentaTemp}${fileExtension}`;

        // Sube / reemplaza directamente en Cloudflare R2
        await r2StorageClient.uploadFile(r2Path, file.buffer, file.mimetype);

        // Actualiza la ruta en la base de datos
        isUpdatedInDb = await actualizarRutaFotoPerfilCuentaTemporal(
          idCuentaTemp,
          r2Path,
        );
      }

      if (!isUpdatedInDb) {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: "No se encontró el usuario en la base de datos",
          errorType: UserErrorTypes.USER_NOT_FOUND,
        };
        return res.status(404).json(errorResponse);
      }

      // 5. Generar y retornar la URL pre-firmada
      const sessionExpiration =
        userType === TiposUsuario.Administrador
          ? ADMINISTRADORES_SESSION_EXPIRATION
          : CUENTAS_TEMPORALES_SESSION_EXPIRATION;

      // Generar la URL pre-firmada con la duración correspondiente + 300s de margen
      const urlPresigned = await r2StorageClient.getPresignedDownloadUrl(
        r2Path,
        sessionExpiration + 300,
      );

      const response: ResponseSuccessActualizarFotoPerfil = {
        success: true,
        message: "Foto de perfil actualizada exitosamente",
        data: {
          Foto_Perfil_URL: urlPresigned,
        },
      };

      return res.status(200).json(response);
    } catch (error) {
      console.error("Error al actualizar la foto de perfil:", error);

      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "Error interno en el servidor al procesar la foto de perfil",
        errorType: SystemErrorTypes.UNKNOWN_ERROR,
        details: { error: String(error) },
      };

      return res.status(500).json(errorResponse);
    }
  }) as any,
);

export default actualizarFotoPerfilRouter;
