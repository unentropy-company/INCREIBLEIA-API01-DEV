import { Router, Request, Response } from "express";
import { TiposUsuario } from "../../../interfaces/shared/TiposUsuario";
import { Genero } from "../../../interfaces/shared/Genero";
import {
  RequestErrorTypes,
  SystemErrorTypes,
  TokenErrorTypes,
  UserErrorTypes,
  ValidationErrorTypes,
} from "../../../interfaces/shared/errors";
import { buscarAdministradorPorIdSelect } from "../../../core/databases/queries/administradores/buscarAdministradorPorId";
import { buscarCuentaTemporalPorIdSelect } from "../../../core/databases/queries/cuentas-temporales/buscarCuentaTemporalPorId";
import {
  MiPerfilData,
  RequestBodyUpdateMiPerfil,
  ResponseSuccessGetMiPerfil,
  ResponseSuccessUpdateMiPerfil,
} from "../../../interfaces/shared/apis/api01/mi-perfil/types";
import {
  AdministradorAuthenticated,
  CuentaTemporalAuthenticated,
  UserAuthenticatedAPI01,
} from "../../../interfaces/shared/JWTPayload";
import { ADMINISTRADORES_SESSION_EXPIRATION } from "../../../constants/EXPIRACIONES_JWT";
import { r2StorageClient } from "../../../core/buckets/connectors/CloudfareR2";
import { ErrorResponseAPIBase } from "../../../interfaces/shared/apis/types";
import isAdministradorAuthenticated from "../../../middlewares/isAdministradorAuthenticated";
import isCuentaTemporalAuthenticated from "../../../middlewares/isCuentaTemporalAuthenticated";
import checkAuthentication from "../../../middlewares/checkAuthentication";
import { updateMiPerfilSchema } from "./schemas.zod";
import { actualizarDatosPersonalesAdministrador } from "../../../core/databases/queries/administradores/actualizarDatosPersonalesAdministrador";
import cambioFotoPerfilRouter from "./foto-perfil";
import actualizarNombreUsuarioRouter from "./nombre-usuario";

const miPerfilRouter = Router();

// =======================================================================================
//                          DOCUMENTACIÓN SWAGGER / OPENAPI (GET)
// =======================================================================================
/**
 * @openapi
 * /mi-perfil:
 *   get:
 *     summary: Obtener información del perfil del usuario autenticado
 *     description: >
 *       Retorna los datos personales del usuario en sesión (Administrador o Cuenta Temporal).
 *       Si es un Administrador y tiene configurado TOTP, incluye la URI `Totp_Url`.
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
 *                       example: "Juan Manuel"
 *                     Apellidos:
 *                       type: string
 *                       example: "Pérez Chávez"
 *                     Genero:
 *                       type: string
 *                       enum: [M, F]
 *                       example: "M"
 *                     Nombre_Usuario:
 *                       type: string
 *                       example: "admin.user_01"
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
 *                       example: "https://r2.bucket.com/foto.jpg?token=..."
 *                     Totp_Url:
 *                       type: string
 *                       description: "URI totpauth para clientes OTP (solo presente en Administradores con TOTP configurado)."
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
 *                   example: "Token de acceso ausente o inválido"
 *                 errorType:
 *                   type: string
 *                   example: "TOKEN_UNAUTHORIZED"
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
 *                   example: "No se encontraron los datos del usuario."
 *                 errorType:
 *                   type: string
 *                   example: "USER_NOT_FOUND"
 *       500:
 *         description: Error interno del servidor o al consultar la base de datos.
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
miPerfilRouter.get(
  "/",
  isAdministradorAuthenticated,
  isCuentaTemporalAuthenticated,
  checkAuthentication,
  async (req: Request, res: Response) => {
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
          const errorResponse: ErrorResponseAPIBase = {
            success: false,
            message: "No se encontraron los datos del administrador.",
            errorType: UserErrorTypes.USER_NOT_FOUND,
          };
          return res.status(404).json(errorResponse);
        }

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
          const errorResponse: ErrorResponseAPIBase = {
            success: false,
            message: "No se encontraron los datos de la cuenta temporal.",
            errorType: UserErrorTypes.USER_NOT_FOUND,
          };
          return res.status(404).json(errorResponse);
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

      const response: ResponseSuccessGetMiPerfil = {
        success: true,
        message: "Datos del perfil obtenidos exitosamente",
        data: perfilData,
      };

      return res.status(200).json(response);
    } catch (error) {
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "Error interno al obtener los datos del perfil",
        errorType: SystemErrorTypes.DATABASE_ERROR,
      };
      return res.status(500).json(errorResponse);
    }
  },
);

// =======================================================================================
//                          DOCUMENTACIÓN SWAGGER / OPENAPI (PUT)
// =======================================================================================
/**
 * @openapi
 * /mi-perfil:
 *   put:
 *     summary: Actualizar datos personales del perfil (Solo Administradores)
 *     description: >
 *       Reemplaza de forma completa los campos `Nombres`, `Apellidos` y `Genero` del perfil de un Administrador.
 *       Este endpoint está restringido exclusivamente a usuarios de tipo Administrador.
 *     tags:
 *       - Mi Perfil
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - Nombres
 *               - Apellidos
 *               - Genero
 *             properties:
 *               Nombres:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 80
 *                 description: "Nombres del administrador (entre 3 y 80 caracteres)."
 *                 example: "Juan Manuel"
 *               Apellidos:
 *                 type: string
 *                 minLength: 5
 *                 maxLength: 100
 *                 description: "Apellidos del administrador (entre 5 y 100 caracteres)."
 *                 example: "Pérez Chávez"
 *               Genero:
 *                 type: string
 *                 enum: [MASCULINO, FEMENINO, OTRO]
 *                 example: "MASCULINO"
 *     responses:
 *       200:
 *         description: Perfil actualizado exitosamente.
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
 *                   example: "Perfil actualizado exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/MiPerfilData'
 *       400:
 *         description: Parámetros requeridos ausentes o longitud/formato de campos inválido.
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
 *                   example: "El campo Nombres debe tener al menos 3 caracteres"
 *                 errorType:
 *                   type: string
 *                   example: "INVALID_NAME"
 *       401:
 *         description: No autorizado - Token JWT ausente o inválido.
 *       403:
 *         description: Prohibido - Acción permitida únicamente para administradores.
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
 *                   example: "No tiene permisos para realizar esta acción. Solo administradores."
 *                 errorType:
 *                   type: string
 *                   example: "TOKEN_WRONG_ROLE"
 *       404:
 *         description: Administrador no encontrado en la base de datos.
 *       500:
 *         description: Error interno del servidor.
 */
miPerfilRouter.put("/", (async (req: Request, res: Response) => {
  try {
    const userType = req.userType!;

    // 1. Guardrail defensivo de Rol
    if (userType !== TiposUsuario.Administrador) {
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message:
          "No tiene permisos para realizar esta acción. Solo administradores.",
        errorType: TokenErrorTypes.TOKEN_WRONG_ROLE,
      };
      return res.status(403).json(errorResponse);
    }

    // 2. Validación de Body con Zod
    const validation = updateMiPerfilSchema.safeParse(req.body);

    if (!validation.success) {
      const issue = validation.error.issues[0];
      const messageCode = issue.message;

      // Parámetros Faltantes
      if (
        messageCode === "MISSING_NOMBRES" ||
        messageCode === "MISSING_APELLIDOS" ||
        messageCode === "MISSING_GENERO"
      ) {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: "Los campos Nombres, Apellidos y Genero son obligatorios",
          errorType: RequestErrorTypes.MISSING_PARAMETERS,
        };
        return res.status(400).json(errorResponse);
      }

      // Validaciones Nombres
      if (messageCode === "NOMBRES_TOO_SHORT") {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: "El campo Nombres debe tener al menos 3 caracteres",
          errorType: ValidationErrorTypes.INVALID_NAME,
        };
        return res.status(400).json(errorResponse);
      }

      if (messageCode === "NOMBRES_TOO_LONG") {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: "El campo Nombres no debe exceder los 80 caracteres",
          errorType: ValidationErrorTypes.STRING_TOO_LONG,
        };
        return res.status(400).json(errorResponse);
      }

      // Validaciones Apellidos
      if (messageCode === "APELLIDOS_TOO_SHORT") {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: "El campo Apellidos debe tener al menos 5 caracteres",
          errorType: ValidationErrorTypes.INVALID_LASTNAME,
        };
        return res.status(400).json(errorResponse);
      }

      if (messageCode === "APELLIDOS_TOO_LONG") {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: "El campo Apellidos no debe exceder los 100 caracteres",
          errorType: ValidationErrorTypes.STRING_TOO_LONG,
        };
        return res.status(400).json(errorResponse);
      }

      // Validación Género
      if (messageCode === "INVALID_GENERO") {
        const errorResponse: ErrorResponseAPIBase = {
          success: false,
          message: "El género proporcionado no es válido",
          errorType: ValidationErrorTypes.INVALID_GENDER,
        };
        return res.status(400).json(errorResponse);
      }

      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "Error de validación en la solicitud",
        errorType: ValidationErrorTypes.INVALID_FORMAT,
      };
      return res.status(400).json(errorResponse);
    }

    const {
      Nombres,
      Apellidos,
      Genero: generoInput,
    }: RequestBodyUpdateMiPerfil = validation.data;

    const idAdmin = (req.user! as AdministradorAuthenticated).Id_Administrador;

    // 3. Actualización en BD
    await actualizarDatosPersonalesAdministrador(idAdmin, {
      Nombres,
      Apellidos,
      Genero: generoInput,
    });

    // 4. Consulta de datos actualizados
    const administrador = await buscarAdministradorPorIdSelect(idAdmin, [
      "Nombres",
      "Apellidos",
      "Genero",
      "Nombre_Usuario",
      "Correo",
      "Ruta_Foto_Perfil",
      "Totp_Secret",
      "Duracion_Codigos_Totp_Segundos",
    ]);

    if (!administrador) {
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "No se encontraron los datos del administrador.",
        errorType: UserErrorTypes.USER_NOT_FOUND,
      };
      return res.status(404).json(errorResponse);
    }

    // 5. Construcción URI TOTP (si aplica)
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

    // 6. Pre-signed URL foto R2
    const url_presigned =
      administrador.Ruta_Foto_Perfil &&
      (await r2StorageClient.getPresignedDownloadUrl(
        administrador.Ruta_Foto_Perfil,
        ADMINISTRADORES_SESSION_EXPIRATION + 300,
      ));

    const perfilData: MiPerfilData = {
      Nombres: administrador.Nombres,
      Apellidos: administrador.Apellidos,
      Genero: administrador.Genero as Genero,
      Nombre_Usuario: administrador.Nombre_Usuario,
      Correo_Electronico: administrador.Correo,
      Tipo_Usuario: TiposUsuario.Administrador,
      Foto_Perfil_URL: url_presigned || null,
      ...(totpUrl !== null && { Totp_Url: totpUrl }),
    };

    const response: ResponseSuccessUpdateMiPerfil = {
      success: true,
      message: "Perfil actualizado exitosamente",
      data: perfilData,
    };

    return res.status(200).json(response);
  } catch (error) {
    const errorResponse: ErrorResponseAPIBase = {
      success: false,
      message: "Error interno al actualizar los datos del perfil",
      errorType: SystemErrorTypes.DATABASE_ERROR,
    };
    return res.status(500).json(errorResponse);
  }
}) as any);

miPerfilRouter.use(
  "/foto-perfil",
  isAdministradorAuthenticated,
  isCuentaTemporalAuthenticated,
  checkAuthentication,
  cambioFotoPerfilRouter,
);

miPerfilRouter.use(
  "/nombre-usuario",
  isAdministradorAuthenticated,
  checkAuthentication,
  actualizarNombreUsuarioRouter,
);

export default miPerfilRouter;
