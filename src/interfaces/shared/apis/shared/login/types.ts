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

export type ResponseSuccessLogin = ApiResponseBase & {
  data: SuccessLoginData;
};
