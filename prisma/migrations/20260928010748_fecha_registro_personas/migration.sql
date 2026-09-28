/*
  Warnings:

  - Made the column `Fecha_Asignacion` on table `T_Empleados_Empresas` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "T_Empleados_Empresas" ALTER COLUMN "Fecha_Asignacion" SET NOT NULL;

-- AlterTable
ALTER TABLE "T_Personas" ADD COLUMN     "Fecha_Registro" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP;
