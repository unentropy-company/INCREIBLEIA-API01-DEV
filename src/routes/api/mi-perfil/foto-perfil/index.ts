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
import { obtenerRutaFotoPerfilAdministrador } from "../../../../core/databases/queries/administradores/obtenerRutaFotoPerfilAdministrador";
import { actualizarRutaFotoPerfilAdministrador } from "../../../../core/databases/queries/administradores/actualizarRutaFotoPerfilAdministrador";
import { obtenerRutaFotoPerfilCuentaTemporal } from "../../../../core/databases/queries/cuentas-temporales/obtenerRutaFotoPerfilCuentaTemporal";
import { actualizarRutaFotoPerfilCuentaTemporal } from "../../../../core/databases/queries/cuentas-temporales/actualizarRutaFotoPerfilCuentaTemporal";

const actualizarFotoPerfilRouter = Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

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

      // 2. Validar tipo MIME
      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message:
            "El archivo debe ser una imagen válida (formatos permitidos: JPEG, PNG, WEBP)",
          errorType: FileErrorTypes.INVALID_FILE_TYPE,
        };
        return res.status(400).json(errorResponse);
      }

      // 3. Normalizar extensión del nuevo archivo
      let fileExtension = path.extname(file.originalname).toLowerCase();
      if (!fileExtension) {
        if (file.mimetype === "image/png") fileExtension = ".png";
        else if (file.mimetype === "image/webp") fileExtension = ".webp";
        else fileExtension = ".jpeg";
      }

      let r2Path = "";
      let rutaFotoAnterior: string | null = null;
      let isUpdatedInDb = false;

      // 4. Obtener ruta previa, eliminar archivo antiguo y subir nuevo
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

        // Consultar la ruta actual en base de datos
        rutaFotoAnterior = await obtenerRutaFotoPerfilAdministrador(idAdmin);
        r2Path = `Fotos_Perfil/Administradores/A_${idAdmin}${fileExtension}`;

        // Eliminar de R2 si existía y tiene una extensión/nombre diferente
        if (rutaFotoAnterior && rutaFotoAnterior !== r2Path) {
          try {
            await r2StorageClient.deleteFile(rutaFotoAnterior);
          } catch (deleteErr) {
            console.warn(
              `No se pudo eliminar el archivo anterior en R2 (${rutaFotoAnterior}):`,
              deleteErr,
            );
          }
        }

        // Subir nuevo archivo
        await r2StorageClient.uploadFile(r2Path, file.buffer, file.mimetype);

        // Actualizar nueva ruta en la base de datos
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

        // Consultar la ruta actual en base de datos
        rutaFotoAnterior =
          await obtenerRutaFotoPerfilCuentaTemporal(idCuentaTemp);
        r2Path = `Fotos_Perfil/Cuenta_Temporales/CT_${idCuentaTemp}${fileExtension}`;

        // Eliminar de R2 si existía y tiene una extensión/nombre diferente
        if (rutaFotoAnterior && rutaFotoAnterior !== r2Path) {
          try {
            await r2StorageClient.deleteFile(rutaFotoAnterior);
          } catch (deleteErr) {
            console.warn(
              `No se pudo eliminar el archivo anterior en R2 (${rutaFotoAnterior}):`,
              deleteErr,
            );
          }
        }

        // Subir nuevo archivo
        await r2StorageClient.uploadFile(r2Path, file.buffer, file.mimetype);

        // Actualizar nueva ruta en la base de datos
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

      // 5. Generar y retornar URL pre-firmada
      const sessionExpiration =
        userType === TiposUsuario.Administrador
          ? ADMINISTRADORES_SESSION_EXPIRATION
          : CUENTAS_TEMPORALES_SESSION_EXPIRATION;

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
