/*
  Warnings:

  - A unique constraint covering the columns `[Correo]` on the table `T_Personas` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "T_Personas" ALTER COLUMN "Fecha_Registro" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "Fecha_Actualizacion" SET DATA TYPE TIMESTAMPTZ(3);

-- CreateIndex
CREATE UNIQUE INDEX "T_Personas_Correo_key" ON "T_Personas"("Correo");
