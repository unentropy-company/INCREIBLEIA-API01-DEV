import { DocumentoIdentidadPersona } from "../../../interfaces/shared/apis/api01/personas/types";
import { TiposDocumentosIdentidad } from "../../../interfaces/shared/TiposDocumentosIdentidad";

export function parsearDocumentoIdentidad(
  identificador: string,
): DocumentoIdentidadPersona {
  const parts = identificador.split("-");
  const numero = parts[0] || identificador;
  const tipoId = Number(parts[1]) || TiposDocumentosIdentidad.DNI;

  let tipoNombre = "DNI";
  if (tipoId === TiposDocumentosIdentidad.CARNET_EXTRANJERIA) {
    tipoNombre = "CE";
  } else if (tipoId === TiposDocumentosIdentidad.PASAPORTE) {
    tipoNombre = "Pasaporte";
  }

  return {
    Identificador_Completo: identificador,
    Numero_Documento: numero,
    Tipo_Documento_Id: tipoId,
    Tipo_Documento_Nombre: tipoNombre,
  };
}
