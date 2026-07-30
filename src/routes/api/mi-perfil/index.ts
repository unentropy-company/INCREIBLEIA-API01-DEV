import { Router, Request, Response } from "express";
import { TiposUsuario } from "../../../interfaces/shared/TiposUsuario";
import { Genero } from "../../../interfaces/shared/Genero";
import { SystemErrorTypes } from "../../../interfaces/shared/errors";
import { buscarAdministradorPorIdSelect } from "../../../core/databases/queries/administradores/buscarAdministradorPorId";
import { buscarCuentaTemporalPorIdSelect } from "../../../core/databases/queries/cuentas-temporales/buscarCuentaTemporalPorId";
import {
  MiPerfilData,
  ResponseSuccessMiPerfil,
} from "../../../interfaces/shared/apis/api01/mi-perfil/types";
import {
  AdministradorAuthenticated,
  CuentaTemporalAuthenticated,
  UserAuthenticatedAPI01,
} from "../../../interfaces/shared/JWTPayload";
import { ADMINISTRADORES_SESSION_EXPIRATION } from "../../../constants/EXPIRACIONES_JWT";
import { r2StorageClient } from "../../../core/buckets/connectors/CloudfareR2";

const miPerfilRouter = Router();

/**
 * @swagger
 * /mi-perfil:
 *   get:
 *     summary: Obtener información del perfil del usuario autenticado
 *     description: Retorna los datos personales del usuario en sesión (Administrador o Cuenta Temporal). Si es un Administrador y tiene configurado TOTP, incluye la URL del secreto para la app de autenticación.
 *     tags:
 *       - Mi Perfil
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil de usuario obtenido exitosamente.
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
 *                   example: "Datos del perfil obtenidos exitosamente"
 *                 data:
 *                   type: object
 *                   properties:
 *                     Nombres:
 *                       type: string
 *                       example: "Juan"
 *                     Apellidos:
 *                       type: string
 *                       example: "Pérez"
 *                     Genero:
 *                       type: string
 *                       enum: [MASCULINO, FEMENINO, OTRO]
 *                       example: "MASCULINO"
 *                     Nombre_Usuario:
 *                       type: string
 *                       example: "admin123"
 *                     Correo_Electronico:
 *                       type: string
 *                       nullable: true
 *                       example: "admin@dominio.com"
 *                     Tipo_Usuario:
 *                       type: string
 *                       enum: [Administrador, Cuenta_Temporal]
 *                       example: "Administrador"
 *                     Foto_Perfil_URL:
 *                       type: string
 *                       nullable: true
 *                       example: "https://r2.cloudfare.com/presigned-url..."
 *                     Totp_Secret_Url:
 *                       type: string
 *                       description: "URI totpauth para clientes OTP (Solo Administradores si han activado TOTP)."
 *                       example: "otpauth://totp/INCREIBLE%20IA:admin%40dominio.com?secret=JBSWY3DPEHPK3PXP&issuer=INCREIBLE%20IA&period=30"
 *       401:
 *         description: No autorizado - Token JWT ausente, inválido o expirado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Token inválido o expirado"
 *                 errorType:
 *                   type: string
 *                   example: "UNAUTHORIZED_ERROR"
 *       404:
 *         description: Usuario no encontrado en la base de datos.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "No se encontraron los datos del administrador."
 *                 errorType:
 *                   type: string
 *                   example: "UNKNOWN_ERROR"
 *       500:
 *         description: Error interno del servidor.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Error interno al obtener los datos del perfil"
 *                 errorType:
 *                   type: string
 *                   example: "DATABASE_ERROR"
 */
miPerfilRouter.get("/", async (req: Request, res: Response) => {
  try {
    const user = req.user! as UserAuthenticatedAPI01;
    const userType = req.userType!;

    let perfilData: MiPerfilData;

    if (userType === TiposUsuario.Administrador) {
      const administrador = await buscarAdministradorPorIdSelect(
        (user as AdministradorAuthenticated).Id_Administrador,
        [
          "Nombres",
          "Apellidos",
          "Genero",
          "Nombre_Usuario",
          "Correo",
          "Ruta_Foto_Perfil",
          "Totp_Secret",
          "Duracion_Codigos_Totp_Segundos",
        ],
      );

      if (!administrador) {
        return res.status(404).json({
          success: false,
          message: "No se encontraron los datos del administrador.",
          errorType: SystemErrorTypes.UNKNOWN_ERROR,
        });
      }

      // Se evalúa strictly que ambos campos existan en BD (no sean null/undefined)
      let totpUrl: string | null = null;

      if (
        administrador.Totp_Secret !== null &&
        administrador.Duracion_Codigos_Totp_Segundos !== null
      ) {
        const issuer = encodeURIComponent("INCREIBLE IA");
        const label = encodeURIComponent(
          administrador.Correo || administrador.Nombre_Usuario,
        );
        const period = administrador.Duracion_Codigos_Totp_Segundos;

        totpUrl = `otpauth://totp/${issuer}:${label}?secret=${administrador.Totp_Secret}&issuer=${issuer}&period=${period}`;
      }

      const url_presigned =
        administrador.Ruta_Foto_Perfil &&
        (await r2StorageClient.getPresignedDownloadUrl(
          administrador.Ruta_Foto_Perfil,
          ADMINISTRADORES_SESSION_EXPIRATION + 300,
        ));

      perfilData = {
        Nombres: administrador.Nombres,
        Apellidos: administrador.Apellidos,
        Genero: administrador.Genero as Genero,
        Nombre_Usuario: administrador.Nombre_Usuario,
        Correo_Electronico: administrador.Correo,
        Tipo_Usuario: TiposUsuario.Administrador,
        Foto_Perfil_URL: url_presigned || null,
        ...(totpUrl !== null && { Totp_Url: totpUrl }),
      };
    } else {
      const cuentaTemporal = await buscarCuentaTemporalPorIdSelect(
        (user as CuentaTemporalAuthenticated).Id_Cuenta_Temporal,
        [
          "Nombres_Persona",
          "Apellidos_Persona",
          "Genero",
          "Nombre_Usuario_Temporal",
          "Ruta_Foto_Perfil",
        ],
      );

      if (!cuentaTemporal) {
        return res.status(404).json({
          success: false,
          message: "No se encontraron los datos de la cuenta temporal.",
          errorType: SystemErrorTypes.UNKNOWN_ERROR,
        });
      }

      const url_presigned =
        cuentaTemporal.Ruta_Foto_Perfil &&
        (await r2StorageClient.getPresignedDownloadUrl(
          cuentaTemporal.Ruta_Foto_Perfil,
          ADMINISTRADORES_SESSION_EXPIRATION + 300,
        ));

      perfilData = {
        Nombres: cuentaTemporal.Nombres_Persona,
        Apellidos: cuentaTemporal.Apellidos_Persona,
        Genero: cuentaTemporal.Genero as Genero,
        Nombre_Usuario: cuentaTemporal.Nombre_Usuario_Temporal,
        Tipo_Usuario: TiposUsuario.Cuenta_Temporal,
        Foto_Perfil_URL: url_presigned || null,
      };
    }

    const response: ResponseSuccessMiPerfil = {
      success: true,
      message: "Datos del perfil obtenidos exitosamente",
      data: perfilData,
    };

    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error interno al obtener los datos del perfil",
      errorType: SystemErrorTypes.DATABASE_ERROR,
    });
  }
});

export default miPerfilRouter;
