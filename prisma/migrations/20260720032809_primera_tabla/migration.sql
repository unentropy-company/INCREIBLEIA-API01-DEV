-- CreateTable
CREATE TABLE "T_Administradores" (
    "Id_Administrador" SERIAL NOT NULL,
    "Nombres" VARCHAR(80) NOT NULL,
    "Apellidos" VARCHAR(100) NOT NULL,
    "Correo" VARCHAR(200) NOT NULL,
    "Nombre_Usuario" VARCHAR(100) NOT NULL,
    "Contraseña" VARCHAR(300) NOT NULL,
    "Ruta_Foto_Perfil" VARCHAR(300) NOT NULL,
    "Totp_Secret" VARCHAR(100),
    "Duracion_Codigos_Totp_Segundos" INTEGER,

    CONSTRAINT "T_Administradores_pkey" PRIMARY KEY ("Id_Administrador")
);
