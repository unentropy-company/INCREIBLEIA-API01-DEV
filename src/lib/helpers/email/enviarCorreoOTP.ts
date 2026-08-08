import nodemailer from "nodemailer";
import { OTP_CODE_FOR_UPDATING_EMAIL_MINUTES } from "../../../constants/ACTUALIZACION_OTP_VIA_CORREO";

export function generarCodigoOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Servicio para envío de correos OTP compatible con Gmail y Hostinger/Custom SMTP.
 */
export async function enviarCorreoOTP(
  destinatario: string,
  codigo: string,
  nombreUsuario: string,
): Promise<void> {
  try {
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASSWORD;
    const provider = process.env.EMAIL_SERVICE_PROVIDER || "GMAIL"; // 'GMAIL' o 'HOSTINGER'

    if (!user || !pass) {
      throw new Error(
        "Variables de entorno EMAIL_USER o EMAIL_PASSWORD no configuradas",
      );
    }

    // Configuración según el proveedor
    const isHostinger = provider.toUpperCase() === "HOSTINGER";

    const transporterConfig = isHostinger
      ? {
          host: process.env.EMAIL_HOST || "smtp.hostinger.com",
          port: Number(process.env.EMAIL_PORT) || 465,
          secure: true, // TLS/SSL para puerto 465
          auth: { user, pass },
        }
      : {
          host: "smtp.gmail.com",
          port: 587,
          secure: false,
          auth: { user, pass },
        };

    const transporter = nodemailer.createTransport(transporterConfig);

    const asunto = "Código de verificación para cambio de correo electrónico";

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 20px; }
          .container { max-width: 550px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
          .header { text-align: center; border-bottom: 2px solid #eaeaea; padding-bottom: 15px; margin-bottom: 20px; }
          .title { color: #1e293b; font-size: 22px; font-weight: bold; margin: 0; }
          .code-box { background-color: #f1f5f9; padding: 18px; text-align: center; font-size: 30px; font-weight: bold; letter-spacing: 6px; color: #0f172a; border-radius: 8px; margin: 20px 0; border: 1px dashed #cbd5e1; }
          .highlight { color: #e11d48; font-weight: bold; }
          .footer { font-size: 12px; color: #94a3b8; text-align: center; margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="title">Verificación de Correo Electrónico</h1>
          </div>
          <p>Hola <strong>${nombreUsuario}</strong>,</p>
          <p>Recibimos una solicitud para asociar este correo a tu cuenta. Ingresa el siguiente código de verificación de 6 dígitos:</p>
          
          <div class="code-box">${codigo}</div>
          
          <p>Este código expira en <span class="highlight">${OTP_CODE_FOR_UPDATING_EMAIL_MINUTES} minutos</span>.</p>
          <p>Si no realizaste esta solicitud, puedes ignorar este correo de forma segura.</p>
          
          <div class="footer">
            <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: `"Sistema de Perfil" <${user}>`,
      to: destinatario,
      subject: asunto,
      html: htmlContent,
    });
  } catch (error) {
    console.error("Error en enviarCorreoOTP:", error);
    throw new Error("No se pudo enviar el correo de verificación");
  }
}
