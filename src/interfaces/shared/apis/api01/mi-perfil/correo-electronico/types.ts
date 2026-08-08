import { ApiResponseBase } from "../../../types";

export interface RequestBodyActualizarCorreoElectronico {
  Nuevo_Correo_Electronico: string;
}

//Solo se devolvera un message indicando que se ha enviado un correo de confirmacion al nuevo correo electronico para validar que el correo electronico es valido y que el usuario tiene acceso a el.
export type ResponseSuccessActualizarCorreoElectronico = ApiResponseBase & {};

export interface RequestBodyConfirmarCambioCorreoElectronico {
  Codigo_OTP: string;
}

export type ResponseSuccessConfirmarCambioCorreoElectronico =
  ApiResponseBase & {
    data: {
      Nuevo_Correo_Electronico: string;
    };
  };
