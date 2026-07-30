import { ApiResponseBase } from "../../../../types";

export interface DesactivarTotpRequest {
  Contraseña: string;
}

export interface ResponseSuccessDesactivarTotp extends ApiResponseBase {}