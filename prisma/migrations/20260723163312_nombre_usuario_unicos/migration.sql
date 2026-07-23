/*
  Warnings:

  - A unique constraint covering the columns `[Nombre_Usuario]` on the table `T_Administradores` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[Nombre_Usuario_Temporal]` on the table `T_Cuentas_Temporales` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "T_Administradores_Nombre_Usuario_key" ON "T_Administradores"("Nombre_Usuario");

-- CreateIndex
CREATE UNIQUE INDEX "T_Cuentas_Temporales_Nombre_Usuario_Temporal_key" ON "T_Cuentas_Temporales"("Nombre_Usuario_Temporal");
