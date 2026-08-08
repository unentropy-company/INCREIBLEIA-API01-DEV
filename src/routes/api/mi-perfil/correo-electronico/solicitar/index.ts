import { Router, Request, Response } from "express";
import z from "zod";

import {
  DataConflictErrorTypes,
  PermissionErrorTypes,
  RequestErrorTypes,
  SystemErrorTypes,
  UserErrorTypes,
} from "../../../../../interfaces/shared/errors";
import { ErrorResponseAPIBase } from "../../../../../interfaces/shared/apis/types";
import { TiposUsuario } from "../../../../../interfaces/shared/TiposUsuario";

import {
  generarCodigoOTP,
  enviarCorreoOTP,
} from "../../../../../lib/helpers/email/enviarCorreoOTP";
import {
  RequestBodyActualizarCorreoElectronico,
  ResponseSuccessActualizarCorreoElectronico,
} from "../../../../../interfaces/shared/apis/api01/mi-perfil/correo-electronico/types";
import { existeCorreoEnSistema } from "../../../../../core/databases/queries/administradores/existeCorreoEnSistema";
import { OTP_CODE_FOR_UPDATING_EMAIL_MINUTES } from "../../../../../constants/ACTUALIZACION_OTP_VIA_CORREO";
import { reemplazarCodigoOTP } from "../../../../../core/databases/queries/codigos-top/reemplazarCodigoOTP";
import isAdministradorAuthenticated from "../../../../../middlewares/isAdministradorAuthenticated";
import checkAuthentication from "../../../../../middlewares/checkAuthentication";
import confirmarCambioCorreoRouter from "../confirmar";

export const solicitarCambioCorreoSchema = z.object({
  Nuevo_Correo_Electronico: z
    .string({ message: "FIELD_REQUIRED" })
    .min(1, "FIELD_REQUIRED")
    .email("INVALID_EMAIL")
    .max(150, "STRING_TOO_LONG"),
});

const solicitarCambioCorreoRouter = Router();

/**
 * @openapi
 * /mi-perfil/correo-electronico:
 *   put:
 *     summary: Solicitar cambio de correo electrónico (Solo Administradores)
 *     description: Genera y envía un código de 6 dígitos al nuevo correo electrónico para verificar el acceso. Endpoint exclusivo para Administradores.
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
 *               - Nuevo_Correo_Electronico
 *             properties:
 *               Nuevo_Correo_Electronico:
 *                 type: string
 *                 example: "nuevo_correo@dominio.com"
 *     responses:
 *       200:
 *         description: Código de verificación enviado exitosamente.
 *       400:
 *         description: Formato de correo inválido o campo faltante.
 *       403:
 *         description: No permitido para Cuentas Temporales.
 *       409:
 *         description: El correo electrónico ya se encuentra registrado.
 *       500:
 *         description: Error interno o falla al enviar el correo.
 */
solicitarCambioCorreoRouter.put("/", (async (req: Request, res: Response) => {
  try {
    const authUser =
      (req.user as any)?.user || (req.user as any)?.data || req.user;
    const userType = req.userType!;

    // 1. Validar que la cuenta sea de tipo Administrador
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
    const nombreUsuario = authUser?.Nombres
      ? `${authUser.Nombres} ${authUser.Apellidos || ""}`.trim()
      : authUser?.Nombre_Usuario || "Administrador";

    if (!idAdmin) {
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "No se pudo identificar la sesión del administrador",
        errorType: UserErrorTypes.USER_NOT_FOUND,
      };
      return res.status(401).json(errorResponse);
    }

    // 2. Validar payload Zod
    const validation = solicitarCambioCorreoSchema.safeParse(req.body);
    if (!validation.success) {
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message: "Los parámetros enviados en la solicitud son inválidos",
        errorType: RequestErrorTypes.INVALID_PARAMETERS,
        details: validation.error.flatten().fieldErrors,
      };
      return res.status(400).json(errorResponse);
    }

    const { Nuevo_Correo_Electronico }: RequestBodyActualizarCorreoElectronico =
      validation.data;

    // 3. Verificar que el correo no pertenezca a otro Administrador
    const correoExiste = await existeCorreoEnSistema(Nuevo_Correo_Electronico);
    if (correoExiste) {
      const errorResponse: ErrorResponseAPIBase = {
        success: false,
        message:
          "El correo electrónico ya se encuentra registrado en el sistema",
        errorType: DataConflictErrorTypes.VALUE_ALREADY_IN_USE,
      };
      return res.status(409).json(errorResponse);
    }

    // 4. Generar OTP y Timestamps
    const codigoOTP = generarCodigoOTP();
    const ahora = Date.now();
    const fechaExpiracion =
      ahora + OTP_CODE_FOR_UPDATING_EMAIL_MINUTES * 60 * 1000;

    // 5. Guardar en T_Codigos_OTP (Tipo_Usuario = "A")
    await reemplazarCodigoOTP({
      codigo: codigoOTP,
      timestampCreacion: BigInt(ahora),
      timestampExpiracion: BigInt(fechaExpiracion),
      correoDestino: Nuevo_Correo_Electronico,
      tipoUsuario: "A",
      idUsuario: String(idAdmin),
    });

    // 6. Enviar correo vía Nodemailer
    await enviarCorreoOTP(Nuevo_Correo_Electronico, codigoOTP, nombreUsuario);

    // 7. Responder exitosamente
    const successResponse: ResponseSuccessActualizarCorreoElectronico = {
      success: true,
      message:
        "Se ha enviado un correo de confirmación al nuevo correo electrónico para validar su acceso.",
    };

    return res.status(200).json(successResponse);
  } catch (error: any) {
    console.error("Error al solicitar cambio de correo:", error);

    const errorResponse: ErrorResponseAPIBase = {
      success: false,
      message:
        "Ocurrió un error interno al procesar el envío del correo de verificación",
      errorType: SystemErrorTypes.EXTERNAL_SERVICE_ERROR,
      details: { error: String(error) },
    };

    return res.status(500).json(errorResponse);
  }
}) as any);

solicitarCambioCorreoRouter.use(
  "/confirmar",
  isAdministradorAuthenticated,
  checkAuthentication,
  confirmarCambioCorreoRouter,
);

export default solicitarCambioCorreoRouter;
