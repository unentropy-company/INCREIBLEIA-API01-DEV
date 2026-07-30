import { Genero } from "../../../Genero";
import { TiposUsuario } from "../../../TiposUsuario";
import { ApiResponseBase } from "../../types";

/**
 * Body para la petición de login
 */
export interface LoginBody {
  Nombre_Usuario: string;
  Contraseña: string;
}

export interface ValidateTotpBody extends SuccessLoginDataWithTotp {
  Totp_Code: string;
}

/**
 * Datos retornados en login exitoso
 */
export interface SuccessLoginData {
  Nombre_Usuario: string;
  Tipo_Usuario: TiposUsuario;
  Nombres: string;
  Apellidos: string;
  Genero: Genero;
  token: string;
  Foto_Perfil_URL: string | null;
}

/**
 * Datos retornados en login exitoso cuando TOTP está activado y se requiere un token temporal para completar la autenticación
 */
export interface SuccessLoginDataWithTotp {
  Totp_Operation_Token: string;
}

export type ResponseSuccessLogin = ApiResponseBase & {
  data: SuccessLoginData;
};

export type ResponseSuccessLoginWithTotp = ApiResponseBase & {
  data: SuccessLoginDataWithTotp;
};
