import { Genero } from "../../../Genero";
import { TiposUsuario } from "../../../TiposUsuario";
import { ApiResponseBase } from "../../types";

export interface MiPerfilData {
  Nombres: string;
  Apellidos: string;
  Genero: Genero;
  Nombre_Usuario: string;
  Correo_Electronico?: string;
  Tipo_Usuario: TiposUsuario;
  Foto_Perfil_URL: string | null;
  Totp_Url?: string;
}

export type ResponseSuccessGetMiPerfil = ApiResponseBase & {
  data: MiPerfilData;
};

export interface RequestBodyUpdateMiPerfil {
  Nombres: string;
  Apellidos: string;
  Genero: Genero;
}

export type ResponseSuccessUpdateMiPerfil = ApiResponseBase & {
  data: MiPerfilData;
};
