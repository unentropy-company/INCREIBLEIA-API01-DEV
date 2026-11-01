/*
  Warnings:

  - Added the required column `Fechas_ISO_Estados` to the `T_Clases` table without a default value. This is not possible if the table is not empty.
  - Added the required column `Modalidad_Clase` to the `T_Clases` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "T_Clases" ADD COLUMN     "Estado_Clase" CHAR(2) NOT NULL DEFAULT 'P',
ADD COLUMN     "Fechas_ISO_Estados" JSONB NOT NULL,
ADD COLUMN     "Modalidad_Clase" CHAR(1) NOT NULL;
