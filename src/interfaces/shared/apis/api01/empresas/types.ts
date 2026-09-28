export interface EmpresaSelectorItem {
  Id_Empresa: number;
  RUC: string;
  Razon_Social: string;
  Cantidad_Empleados_Actuales: number;
}

export interface SelectorEmpresasData {
  Total_Personas_Sin_Empresa: number;
  Total_Resultados_Filtrados: number;
  Pagina_Actual: number;
  Total_Paginas: number;
  items: EmpresaSelectorItem[];
}
