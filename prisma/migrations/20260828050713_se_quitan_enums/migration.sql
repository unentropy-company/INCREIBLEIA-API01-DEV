/*
  Warnings:

  - Changed the type of `Tipo` on the `T_Certificados` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `Estado_Verificacion_CIP` on the `T_Intructores` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "T_Certificados" DROP COLUMN "Tipo",
ADD COLUMN     "Tipo" CHAR(1) NOT NULL;

-- AlterTable
ALTER TABLE "T_Intructores" DROP COLUMN "Estado_Verificacion_CIP",
ADD COLUMN     "Estado_Verificacion_CIP" CHAR(1) NOT NULL;

-- DropEnum
DROP TYPE "EstadoVerificacionCIP";

-- DropEnum
DROP TYPE "TipoCertificado";
