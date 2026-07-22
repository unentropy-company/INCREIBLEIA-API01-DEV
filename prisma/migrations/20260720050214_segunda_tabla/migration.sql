-- CreateTable
CREATE TABLE "T_Cuentas_Temporales" (
    "Id_Cuenta_Temporal" SERIAL NOT NULL,
    "Nombres_Persona" VARCHAR(80) NOT NULL,
    "Apellidos_Persona" VARCHAR(100) NOT NULL,
    "Nombre_Usuario_Temporal" VARCHAR(100) NOT NULL,
    "Contraseña_Usuario_Temporal" VARCHAR(300) NOT NULL,
    "Fecha_Hora_Inicio" TIMESTAMP(3) NOT NULL,
    "Fecha_Hora_Final" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "T_Cuentas_Temporales_pkey" PRIMARY KEY ("Id_Cuenta_Temporal")
);
