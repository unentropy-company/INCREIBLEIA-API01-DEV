-- AlterTable
ALTER TABLE "T_Administradores" ALTER COLUMN "Genero" DROP DEFAULT;

-- AlterTable
ALTER TABLE "T_Cuentas_Temporales" ADD COLUMN     "Ruta_Foto_Perfil" VARCHAR(300);
