/*
  Warnings:

  - Added the required column `Estado` to the `T_Cuentas_Temporales` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "T_Cuentas_Temporales" ADD COLUMN     "Estado" BOOLEAN NOT NULL;
