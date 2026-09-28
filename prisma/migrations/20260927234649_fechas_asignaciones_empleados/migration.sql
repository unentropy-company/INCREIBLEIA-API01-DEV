-- AlterTable
ALTER TABLE "T_Empleados_Empresas" ADD COLUMN     "Fecha_Asignacion" DATE,
ADD COLUMN     "Fecha_Fin_Asignacion" DATE;

-- AlterTable
ALTER TABLE "T_Intructores" ALTER COLUMN "Ruta_Curriculum" DROP NOT NULL;
