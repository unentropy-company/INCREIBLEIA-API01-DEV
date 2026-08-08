import { Router, Request, Response } from "express";

import { TiposUsuario } from "../../../../../interfaces/shared/TiposUsuario";
import { ErrorResponseAPIBase } from "../../../../../interfaces/shared/apis/types";
import {
  AuthenticationErrorTypes,
  PermissionErrorTypes,
  RequestErrorTypes,
  SystemErrorTypes,
  UserErrorTypes,
} from "../../../../../interfaces/shared/errors";
import {
  RequestBodyConfirmarCambioCorreoElectronico,
  ResponseSuccessConfirmarCambioCorreoElectronico,
} from "../../../../../interfaces/shared/apis/api01/mi-perfil/correo-electronico/types";
import {
  eliminarCodigoOTPAdmin,
  obtenerCodigoOTPAdmin,
} from "../../../../../core/databases/queries/codigos-top/gestionCodigosOTP";
import { confirmarCambioCorreoSchema } from "./schemas.zod";
import { actualizarCorreoAdministrador } from "../../../../../core/databases/queries/administradores/actualizarCorreoAdministrador";

const confirmarCambioCorreoRouter = Router();

/**
 * @openapi
 * /mi-perfil/correo-electronico/confirmar:
 *   put:
 *     summary: Confirmar cambio de correo electrónico con código OTP
 *     description: Valida el código OTP de 6 dígitos. Aplica la regla de un solo intento; si falla o está expirado, invalida la solicitud inmediatamente.
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
 *               - Codigo_OTP
 *             properties:
 *               Codigo_OTP:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Correo actualizado exitosamente.
 *       400:
 *         description: Parámetros o formato de OTP inválidos / Código incorrecto o expirado.
 *       403:
 *         description: Acción no permitida para Cuentas Temporales.
 *       404:
 *         description: No se encontró ninguna solicitud activa para este administrador.
 *       500:
 *         description: Error interno en base de datos.
 */
confirmarCambioCorreoRouter.put("/", (async (
  req: Request,
  res: Response,
) => {
  try {
    const authUser =
      (req.user as any)?.user || (req.user as any)?.data || req.user;
    const userType = req.userType!;

    // 1. Restricción de rol: Solo Administradores
    if (userType !== TiposUsuario.Administrador) {
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message:
          "Esta funcionalidad es exclusiva para cuentas de Administrador",
        errorType: PermissionErrorTypes.PERMISSION_DENIED,
      };
      return res.status(403).json(errorResponse);
    }

    const idAdmin = authUser?.Id_Administrador;
    if (!idAdmin) {
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "No se pudo identificar la sesión del administrador",
        errorType: UserErrorTypes.USER_NOT_FOUND,
      };
      return res.status(401).json(errorResponse);
    }

    // 2. Validación de payload Zod
    const validation = confirmarCambioCorreoSchema.safeParse(req.body);
    if (!validation.success) {
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message:
          "El código OTP enviado es inválido o no cumple con el formato de 6 dígitos",
        errorType: RequestErrorTypes.INVALID_PARAMETERS,
        details: validation.error.flatten().fieldErrors,
      };
      return res.status(400).json(errorResponse);
    }

    const { Codigo_OTP }: RequestBodyConfirmarCambioCorreoElectronico =
      validation.data;

    // 3. Buscar si existe una solicitud activa para este administrador
    const registroOTP = await obtenerCodigoOTPAdmin(String(idAdmin));

    if (!registroOTP) {
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message:
          "No tienes ninguna solicitud de cambio de correo pendiente o el código ya fue descartado",
        errorType: AuthenticationErrorTypes.VERIFICATION_FAILED,
      };
      return res.status(404).json(errorResponse);
    }

    const ahora = Date.now();
    const timestampExpiracion = Number(registroOTP.Timestamp_Expiracion);

    // 4. Verificar expiración del código
    if (ahora > timestampExpiracion) {
      // Regla estricta: Se elimina la solicitud expirada
      await eliminarCodigoOTPAdmin(String(idAdmin));

      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message:
          "El código de verificación ha expirado. Por favor solicita uno nuevo.",
        errorType: AuthenticationErrorTypes.VERIFICATION_FAILED,
      };
      return res.status(400).json(errorResponse);
    }

    // 5. Comparar el código OTP ingresado
    if (registroOTP.Codigo !== Codigo_OTP) {
      // REGLA DE UN SOLO INTENTO: Eliminación inmediata tras el primer intento fallido
      await eliminarCodigoOTPAdmin(String(idAdmin));

      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message:
          "El código de verificación es incorrecto. Se ha cancelado la solicitud por seguridad, solicita un nuevo código.",
        errorType: AuthenticationErrorTypes.OTP_INVALID,
      };
      return res.status(400).json(errorResponse);
    }

    // 6. ÉXITO: Actualizar correo en T_Administradores
    const nuevoCorreo = registroOTP.Correo_Destino;
    await actualizarCorreoAdministrador(Number(idAdmin), nuevoCorreo);

    // 7. Eliminar el código OTP consumido
    await eliminarCodigoOTPAdmin(String(idAdmin));

    // 8. Responder con la estructura tipada
    const successResponse: ResponseSuccessConfirmarCambioCorreoElectronico = {
      success: true,
      message: "El correo electrónico ha sido actualizado exitosamente",
      data: {
        Nuevo_Correo_Electronico: nuevoCorreo,
      },
    };

    return res.status(200).json(successResponse);
  } catch (error: any) {
    console.error("Error al confirmar cambio de correo:", error);

    const errorResponse: ErrorResponseAPIBase = {
      success: false,
      message:
        "Ocurrió un error interno al confirmar el cambio de correo electrónico",
      errorType: SystemErrorTypes.DATABASE_ERROR,
      details: { error: String(error) },
    };

    return res.status(500).json(errorResponse);
  }
}) as any);

export default confirmarCambioCorreoRouter;
