import { ApiResponseBase } from "../../../types";

export type ResponseSuccessActualizarFotoPerfil = ApiResponseBase & {
  data: {
    Foto_Perfil_URL: string;
  };
};
