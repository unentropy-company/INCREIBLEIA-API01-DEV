import { DocumentoIdentidadPersona } from "../types";

export enum SeccionDetallePersona {
  DETALLES = "detalles",
  HISTORIAL = "historial",
  TODOS = "todos",
}

export interface EmpleoActualDetalle {
  Id_Empleado_Empresa: number;
  Id_Empresa: number;
  RUC: string;
  Razon_Social: string;
  Cargo_Empleado: string | null;
  Correo_Corporativo_Empleado: string | null;
  Fecha_Asignacion: string | null;
}

export interface PersonaDatosFormulario {
  Identificador_Persona: string;
  Documento: DocumentoIdentidadPersona;
  Nombres: string;
  Apellidos: string;
  Celular: string | null;
  Correo: string | null;
  Foto_Perfil_URL: string | null;
  Fecha_Registro: string;
  Fecha_Actualizacion: string | null;
  Empleo_Actual: EmpleoActualDetalle | null;
}

export interface ItemHistorialLaboral {
  Id_Empleado_Empresa: number;
  Cargo: string;
  Fecha_Inicio: string | null;
  Fecha_Fin: string | null;
  Periodo_Texto: string;
  Estado: "Vigente" | "Cerrado";
  Empresa: {
    Id_Empresa: number;
    RUC: string;
    Razon_Social: string;
  };
}

export interface HistorialLaboralPaginado {
  Total_Registros: number;
  Pagina_Actual: number;
  Total_Paginas: number;
  items: ItemHistorialLaboral[];
}

export interface ResponseDetallePersonaData {
  Persona?: PersonaDatosFormulario;
  Historial_Laboral?: HistorialLaboralPaginado;
}

export interface ResponseSuccessGetDetallePersona {
  success: true;
  message: string;
  data: ResponseDetallePersonaData;
}
