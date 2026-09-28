export interface EmpresaActualPersona {
  Id_Empresa: number;
  Razon_Social: string;
}

export interface CertificadosConteoPersona {
  Vigentes: number;
  Vencidos: number;
}

export interface DocumentoIdentidadPersona {
  Identificador_Completo: string;
  Numero_Documento: string;
  Tipo_Documento_Id: number;
  Tipo_Documento_Nombre: string;
}

export interface IndicadoresPersonasData {
  Total_Personas: number;
  Total_Personas_Sin_Empresa: number;
}

export interface PersonaItemListing {
  Identificador_Persona: string;
  Documento: DocumentoIdentidadPersona;
  Nombres: string;
  Apellidos: string;
  Foto_Perfil_URL: string | null;
  Empresa_Actual: EmpresaActualPersona | null;
  Certificados: CertificadosConteoPersona;
}

export interface ListadoPersonasData {
  Indicadores: IndicadoresPersonasData;
  Total_Resultados_Filtrados: number;
  Pagina_Actual: number;
  Total_Paginas: number;
  items: PersonaItemListing[];
}

export interface UltimoRegistroPersonaItem {
  Identificador_Persona: string;
  Documento: DocumentoIdentidadPersona;
  Nombres: string;
  Apellidos: string;
  Empresa_Actual: EmpresaActualPersona | null;
}
