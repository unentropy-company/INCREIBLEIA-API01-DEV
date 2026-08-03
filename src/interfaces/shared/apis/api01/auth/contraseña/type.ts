import { SuccessResponseAPIBase } from "../../../types";

export interface RequestBodyactualizarContraseña {
  Contraseña_Actual: string;
  Nueva_Contraseña: string;
}

export type ResponseSuccessActualizarContraseña = SuccessResponseAPIBase;
