import { T_Cursos_Horario } from "@prisma/client";
import {
  Hora_Minuto_Segundo,
  HorarioSemanalSiasis,
  RangoHorario,
} from "../../interfaces/shared/Horarios";
import { DetalleRecreo } from "../../interfaces/shared/Recreos";
import { DiasSemana } from "../../interfaces/shared/DiasSemana";

/**
 * Convierte un campo TIME de PostgreSQL a Hora_Minuto_Segundo
 * @param time Date o string que representa una hora (PostgreSQL devuelve TIME como string "HH:MM:SS")
 * @returns Objeto Hora_Minuto_Segundo
 */
export function convertirTimeToHMS(time: Date | string): Hora_Minuto_Segundo {
  // Si es un string (formato típico de PostgreSQL: "HH:MM:SS" o "HH:MM:SS.mmm")
  if (typeof time === "string") {
    const partes = time.split(":");
    if (partes.length >= 2) {
      const hora = parseInt(partes[0], 10);
      const minuto = parseInt(partes[1], 10);
      const segundoParte = partes[2] || "0";
      // Remover milisegundos si existen
      const segundo = parseInt(segundoParte.split(".")[0], 10);

      return {
        Hora: hora,
        Minuto: minuto,
        Segundo: segundo,
      };
    }
  }

  // Si es un objeto Date
  if (time instanceof Date) {
    return {
      Hora: time.getHours(),
      Minuto: time.getMinutes(),
      Segundo: time.getSeconds(),
    };
  }

  // Valor por defecto si no se puede parsear
  console.warn("No se pudo convertir el tiempo:", time);
  return {
    Hora: 0,
    Minuto: 0,
    Segundo: 0,
  };
}

/**
 * Convierte Hora_Minuto_Segundo a minutos totales desde medianoche
 * @param hms Objeto Hora_Minuto_Segundo
 * @returns Total de minutos desde medianoche
 */
export function hmsAMinutos(hms: Hora_Minuto_Segundo): number {
  return hms.Hora * 60 + hms.Minuto + hms.Segundo / 60;
}

/**
 * Convierte minutos totales a Hora_Minuto_Segundo
 * @param minutos Total de minutos desde medianoche
 * @returns Objeto Hora_Minuto_Segundo
 */
export function minutosAHMS(minutos: number): Hora_Minuto_Segundo {
  const horas = Math.floor(minutos / 60);
  const minutosRestantes = Math.floor(minutos % 60);
  const segundos = Math.floor((minutos % 1) * 60);

  return {
    Hora: horas,
    Minuto: minutosRestantes,
    Segundo: segundos,
  };
}

/**
 * Suma minutos a una Hora_Minuto_Segundo
 * @param hms Hora_Minuto_Segundo inicial
 * @param minutos Minutos a sumar
 * @returns Nueva Hora_Minuto_Segundo
 */
export function sumarMinutos(
  hms: Hora_Minuto_Segundo,
  minutos: number
): Hora_Minuto_Segundo {
  const totalMinutos = hmsAMinutos(hms) + minutos;
  return minutosAHMS(totalMinutos);
}

/**
 * Calcula el rango horario de un bloque específico
 * @param horaInicioClases Hora de inicio de clases
 * @param indiceBloque Índice del bloque (1, 2, 3, ...)
 * @param duracionHoraAcademica Duración de una hora académica en minutos
 * @param bloqueInicioRecreo Bloque después del cual inicia el recreo
 * @param duracionRecreoMinutos Duración del recreo en minutos
 * @returns RangoHorario del bloque
 */
export function calcularBloqueHorario(
  horaInicioClases: Hora_Minuto_Segundo,
  indiceBloque: number,
  duracionHoraAcademica: number,
  bloqueInicioRecreo: number,
  duracionRecreoMinutos: number
): RangoHorario {
  // Calcular minutos transcurridos hasta el inicio del bloque
  let minutosHastaBloque = (indiceBloque - 1) * duracionHoraAcademica;

  // Si el bloque es después del recreo, agregar la duración del recreo
  if (indiceBloque > bloqueInicioRecreo) {
    minutosHastaBloque += duracionRecreoMinutos;
  }

  const horaInicio = sumarMinutos(horaInicioClases, minutosHastaBloque);
  const horaFin = sumarMinutos(horaInicio, duracionHoraAcademica);

  return {
    Hora_Inicio: horaInicio,
    Hora_Fin: horaFin,
  };
}

/**
 * Calcula el rango horario del recreo de secundaria
 * @param horaInicioClases Hora de inicio de clases
 * @param duracionHoraAcademica Duración de una hora académica en minutos
 * @param bloqueInicioRecreo Bloque después del cual inicia el recreo
 * @param duracionRecreoMinutos Duración del recreo en minutos
 * @returns DetalleRecreo con información del recreo
 */
export function calcularRecreosSecundaria(
  horaInicioClases: Hora_Minuto_Segundo,
  duracionHoraAcademica: number,
  bloqueInicioRecreo: number,
  duracionRecreoMinutos: number
): DetalleRecreo[] {
  // El recreo empieza después del bloque indicado
  const minutosHastaRecreo = bloqueInicioRecreo * duracionHoraAcademica;
  const horaInicioRecreo = sumarMinutos(horaInicioClases, minutosHastaRecreo);
  const horaFinRecreo = sumarMinutos(horaInicioRecreo, duracionRecreoMinutos);

  return [
    {
      Etiqueta: "Recreo de Secundaria",
      RangoHorario: {
        Hora_Inicio: horaInicioRecreo,
        Hora_Fin: horaFinRecreo,
      },
      DuracionMinutos: duracionRecreoMinutos,
      Bloque_Inicio: bloqueInicioRecreo,
    },
  ];
}

/**
 * Calcula el horario semanal de un profesor de secundaria basado en sus cursos
 * @param cursosHorario Array de cursos del profesor
 * @param horaInicioClases Hora de inicio de clases
 * @param duracionHoraAcademica Duración de una hora académica en minutos
 * @param bloqueInicioRecreo Bloque después del cual inicia el recreo
 * @param duracionRecreoMinutos Duración del recreo en minutos
 * @param horarioLaboralInicio Hora de inicio del horario laboral
 * @param horarioLaboralFin Hora de fin del horario laboral
 * @returns HorarioSemanalSiasis con el horario por día
 */
export function calcularHorarioSemanalProfesorSecundaria(
  cursosHorario: T_Cursos_Horario[],
  horaInicioClases: Hora_Minuto_Segundo,
  duracionHoraAcademica: number,
  bloqueInicioRecreo: number,
  duracionRecreoMinutos: number,
  horarioLaboralInicio: Hora_Minuto_Segundo,
  horarioLaboralFin: Hora_Minuto_Segundo
): HorarioSemanalSiasis {
  const horarioSemanal: HorarioSemanalSiasis = {
    [DiasSemana.Domingo]: null,
    [DiasSemana.Lunes]: null,
    [DiasSemana.Martes]: null,
    [DiasSemana.Miercoles]: null,
    [DiasSemana.Jueves]: null,
    [DiasSemana.Viernes]: null,
    [DiasSemana.Sabado]: null,
  };

  // Agrupar cursos por día
  const cursosPorDia: Record<number, T_Cursos_Horario[]> = {};
  cursosHorario.forEach((curso) => {
    if (!cursosPorDia[curso.Dia_Semana]) {
      cursosPorDia[curso.Dia_Semana] = [];
    }
    cursosPorDia[curso.Dia_Semana].push(curso);
  });

  // Calcular rango para cada día
  Object.entries(cursosPorDia).forEach(([dia, cursos]) => {
    if (cursos.length === 0) return;

    // Encontrar el bloque más temprano y más tardío
    let bloqueMinimo = Infinity;
    let bloqueMaximo = -Infinity;

    cursos.forEach((curso) => {
      const bloqueInicio = curso.Indice_Hora_Academica_Inicio;
      const bloqueFin =
        curso.Indice_Hora_Academica_Inicio + curso.Cant_Hora_Academicas - 1;

      bloqueMinimo = Math.min(bloqueMinimo, bloqueInicio);
      bloqueMaximo = Math.max(bloqueMaximo, bloqueFin);
    });

    // Calcular hora de inicio del día
    const rangoInicio = calcularBloqueHorario(
      horaInicioClases,
      bloqueMinimo,
      duracionHoraAcademica,
      bloqueInicioRecreo,
      duracionRecreoMinutos
    );

    // Calcular hora de fin del día
    const rangoFin = calcularBloqueHorario(
      horaInicioClases,
      bloqueMaximo,
      duracionHoraAcademica,
      bloqueInicioRecreo,
      duracionRecreoMinutos
    );

    let horaInicio = rangoInicio.Hora_Inicio;
    let horaFin = rangoFin.Hora_Fin;

    // Si empieza en bloque 1, usar horario laboral
    if (bloqueMinimo === 1) {
      horaInicio = horarioLaboralInicio;
    }

    // Si la hora de fin está cerca del horario laboral de fin, reemplazarla
    const minutosFinActual = hmsAMinutos(horaFin);
    const minutosFinLaboral = hmsAMinutos(horarioLaboralFin);
    const diferencia = minutosFinLaboral - minutosFinActual;

    if (diferencia >= 0 && diferencia < duracionHoraAcademica) {
      horaFin = horarioLaboralFin;
    }

    horarioSemanal[parseInt(dia) as DiasSemana] = {
      Hora_Inicio: horaInicio,
      Hora_Fin: horaFin,
    };
  });

  return horarioSemanal;
}

/**
 * Convierte un array de horarios por días a HorarioSemanalSiasis
 * @param horariosPorDias Array de horarios (con Dia, Hora_Inicio, Hora_Fin)
 * @returns HorarioSemanalSiasis
 */
export function convertirHorariosPorDiasAHorarioSemanal(
  horariosPorDias: Array<{
    Dia: number;
    Hora_Inicio: Date | string;
    Hora_Fin: Date | string;
  }>
): HorarioSemanalSiasis {
  const horarioSemanal: HorarioSemanalSiasis = {
    [DiasSemana.Domingo]: null,
    [DiasSemana.Lunes]: null,
    [DiasSemana.Martes]: null,
    [DiasSemana.Miercoles]: null,
    [DiasSemana.Jueves]: null,
    [DiasSemana.Viernes]: null,
    [DiasSemana.Sabado]: null,
  };

  horariosPorDias.forEach((horario) => {
    horarioSemanal[horario.Dia as DiasSemana] = {
      Hora_Inicio: convertirTimeToHMS(horario.Hora_Inicio),
      Hora_Fin: convertirTimeToHMS(horario.Hora_Fin),
    };
  });

  return horarioSemanal;
}

/**
 * Crea un horario semanal estático para días laborales (Lunes a Viernes)
 * @param horaInicio Hora de inicio
 * @param horaFin Hora de fin
 * @returns HorarioSemanalSiasis
 */
export function crearHorarioSemanalEstatico(
  horaInicio: Hora_Minuto_Segundo,
  horaFin: Hora_Minuto_Segundo
): HorarioSemanalSiasis {
  const rangoHorario: RangoHorario = {
    Hora_Inicio: horaInicio,
    Hora_Fin: horaFin,
  };

  return {
    [DiasSemana.Domingo]: null,
    [DiasSemana.Lunes]: rangoHorario,
    [DiasSemana.Martes]: rangoHorario,
    [DiasSemana.Miercoles]: rangoHorario,
    [DiasSemana.Jueves]: rangoHorario,
    [DiasSemana.Viernes]: rangoHorario,
    [DiasSemana.Sabado]: null,
  };
}
