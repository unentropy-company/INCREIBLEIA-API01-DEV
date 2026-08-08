-- CreateTable
CREATE TABLE "T_Codigos_OTP" (
    "Id_Codigo_OTP" SERIAL NOT NULL,
    "Codigo" VARCHAR(6) NOT NULL,
    "Timestamp_Creacion" BIGINT NOT NULL,
    "Timestamp_Expiracion" BIGINT NOT NULL,
    "Correo_Destino" VARCHAR(70) NOT NULL,
    "Tipo_Usuario" VARCHAR(2) NOT NULL,
    "Id_Usuario" VARCHAR(20) NOT NULL,

    CONSTRAINT "T_Codigos_OTP_pkey" PRIMARY KEY ("Id_Codigo_OTP")
);
