/*
  Warnings:

  - Added the required column `Genero` to the `T_Cuentas_Temporales` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "T_Administradores" ADD COLUMN     "Genero" CHAR(1) NOT NULL DEFAULT 'M';

-- AlterTable
ALTER TABLE "T_Cuentas_Temporales" ADD COLUMN     "Genero" CHAR(1) NOT NULL;
