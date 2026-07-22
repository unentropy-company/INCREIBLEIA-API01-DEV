import { T_Administradores, T_Cuentas_Temporales } from "@prisma/client";
import { TiposUsuario } from "./TiposUsuario";

export interface JWTPayload {
  Id_Usuario: number;
  Tipo_Usuario: TiposUsuario;
  Nombre_Usuario: string;
  iat: number;
  exp: number;
}

export type AdministradorAuthenticated = Pick<
  T_Administradores,
  "Id_Administrador"
> &
  Pick<JWTPayload, "Nombre_Usuario">;

export type CuentaTemporalAuthenticated = Pick<
  T_Cuentas_Temporales,
  "Id_Cuenta_Temporal"
> &
  Pick<JWTPayload, "Nombre_Usuario">;

export type UserAuthenticatedAPI01 =
  | AdministradorAuthenticated
  | CuentaTemporalAuthenticated;
