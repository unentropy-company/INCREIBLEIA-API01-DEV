import { ApiResponseBase } from "../../../../types";

export interface ActivarTotpRequest {
  Contraseña: string;
}

export interface ResponseSuccessActivarTotp extends ApiResponseBase {
  Totp_Url: string;
}