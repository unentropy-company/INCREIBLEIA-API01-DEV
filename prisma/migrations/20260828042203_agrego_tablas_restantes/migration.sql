-- CreateEnum
CREATE TYPE "EstadoVerificacionCIP" AS ENUM ('P', 'R', 'V');

-- CreateEnum
CREATE TYPE "TipoCertificado" AS ENUM ('E', 'P');

-- CreateTable
CREATE TABLE "T_Intructores" (
    "Identificador_Instructor" VARCHAR(20) NOT NULL,
    "Nombres" VARCHAR(80) NOT NULL,
    "Apellidos" VARCHAR(100) NOT NULL,
    "Celular" VARCHAR(20) NOT NULL,
    "Correo" VARCHAR(200),
    "Ruta_Curriculum" VARCHAR(300) NOT NULL,
    "Ruta_Firma" VARCHAR(300) NOT NULL,
    "CIP" VARCHAR(15) NOT NULL,
    "Estado_Verificacion_CIP" "EstadoVerificacionCIP" NOT NULL,
    "Fecha_Verificacion_CIP" DATE,

    CONSTRAINT "T_Intructores_pkey" PRIMARY KEY ("Identificador_Instructor")
);

-- CreateTable
CREATE TABLE "T_Curso" (
    "Id_Curso" SERIAL NOT NULL,
    "Nombre_Completo_Curso" VARCHAR(300) NOT NULL,
    "Abreviatura" VARCHAR(10) NOT NULL,
    "Ruta_Icono" VARCHAR(300) NOT NULL,
    "Ruta_Imagen_Portada" JSONB,

    CONSTRAINT "T_Curso_pkey" PRIMARY KEY ("Id_Curso")
);

-- CreateTable
CREATE TABLE "T_Temas_Curso" (
    "Id_Tema_Curso" SERIAL NOT NULL,
    "Orden" INTEGER NOT NULL,
    "Titulo" VARCHAR(300) NOT NULL,
    "Id_Curso" INTEGER NOT NULL,

    CONSTRAINT "T_Temas_Curso_pkey" PRIMARY KEY ("Id_Tema_Curso")
);

-- CreateTable
CREATE TABLE "T_Preguntas" (
    "Id_Pregunta" SERIAL NOT NULL,
    "Dificultad" SMALLINT NOT NULL,
    "Enunciado" VARCHAR(300) NOT NULL,
    "Alternativas" JSONB NOT NULL,
    "Id_Curso" INTEGER NOT NULL,
    "Id_Tema_Curso" INTEGER,

    CONSTRAINT "T_Preguntas_pkey" PRIMARY KEY ("Id_Pregunta")
);

-- CreateTable
CREATE TABLE "T_Examenes" (
    "Id_Examen" SERIAL NOT NULL,
    "Duracion_Examen_Inicio_Min" INTEGER NOT NULL,
    "Duracion_Examen_Final_Min" INTEGER NOT NULL,
    "Puntaje_Maximo" INTEGER NOT NULL,
    "Puntaje_Aprobatorio" INTEGER NOT NULL,
    "Hora_Inicio_Examen_Inicio" DATE NOT NULL,
    "Hora_Inicio_Examen_Final" DATE NOT NULL,

    CONSTRAINT "T_Examenes_pkey" PRIMARY KEY ("Id_Examen")
);

-- CreateTable
CREATE TABLE "T_Preguntas_Examenes" (
    "Id_Pregunta_Examen" SERIAL NOT NULL,
    "Id_Pregunta" INTEGER NOT NULL,
    "Id_Examen" INTEGER NOT NULL,
    "Puntaje_Pregunta_Examen" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "T_Preguntas_Examenes_pkey" PRIMARY KEY ("Id_Pregunta_Examen")
);

-- CreateTable
CREATE TABLE "T_Clases" (
    "Id_Clase" VARCHAR(8) NOT NULL,
    "Fecha_Clase" DATE NOT NULL,
    "Hora_Inicio" TIMESTAMP(3) NOT NULL,
    "Rutas_Fotos" JSONB,
    "Rutas_Videos" JSONB,
    "Minimo_Estudiantes" INTEGER NOT NULL,
    "Duracion_Horas" DOUBLE PRECISION NOT NULL,
    "Identificador_Instructor" VARCHAR(20) NOT NULL,
    "Codigo_Curso" INTEGER NOT NULL,
    "Id_Examen" INTEGER NOT NULL,

    CONSTRAINT "T_Clases_pkey" PRIMARY KEY ("Id_Clase")
);

-- CreateTable
CREATE TABLE "T_Capacitaciones_Por_Empresa" (
    "Id_Capacitacion_Empresa" SERIAL NOT NULL,
    "Numero_Capacitacion_Segun_Curso" INTEGER NOT NULL,
    "Ruta_Informe_Final" VARCHAR(300) NOT NULL,
    "Ruta_Registro_Capacitacion" VARCHAR(300) NOT NULL,
    "Correo_Destinatario_Envio_Resultados" VARCHAR(200) NOT NULL,
    "Id_Clase" VARCHAR(8) NOT NULL,

    CONSTRAINT "T_Capacitaciones_Por_Empresa_pkey" PRIMARY KEY ("Id_Capacitacion_Empresa")
);

-- CreateTable
CREATE TABLE "T_Capacitacion_Empleado_Empresa" (
    "Id_Capacitacion_Empleado_Empresa" SERIAL NOT NULL,
    "Resultado_Examen_Inicio" JSONB NOT NULL,
    "Resultados_Examen_Final" JSONB NOT NULL,
    "Ruta_Registro_Capacitacion" VARCHAR(300) NOT NULL,
    "Correo_Destinatario_Envio_Resultados" VARCHAR(255) NOT NULL,
    "Id_Capacitacion_Empresa" INTEGER NOT NULL,
    "Id_Empleado_Empresa" INTEGER NOT NULL,

    CONSTRAINT "T_Capacitacion_Empleado_Empresa_pkey" PRIMARY KEY ("Id_Capacitacion_Empleado_Empresa")
);

-- CreateTable
CREATE TABLE "T_Empresas" (
    "Id_Empresa" SERIAL NOT NULL,
    "RUC" VARCHAR(11) NOT NULL,
    "Razon_Social" VARCHAR(250) NOT NULL,
    "Celular_Contacto" VARCHAR(20) NOT NULL,
    "Telefono_Contacto" VARCHAR(20),
    "Correo_Contacto" VARCHAR(255) NOT NULL,

    CONSTRAINT "T_Empresas_pkey" PRIMARY KEY ("Id_Empresa")
);

-- CreateTable
CREATE TABLE "T_Personas" (
    "Identificador_Persona" VARCHAR(20) NOT NULL,
    "Nombres" VARCHAR(80) NOT NULL,
    "Apellidos" VARCHAR(100) NOT NULL,
    "Celular" VARCHAR(20) NOT NULL,
    "Correo" VARCHAR(200),
    "Ruta_Foto" VARCHAR(300) NOT NULL,

    CONSTRAINT "T_Personas_pkey" PRIMARY KEY ("Identificador_Persona")
);

-- CreateTable
CREATE TABLE "T_Empleados_Empresas" (
    "Id_Empleado_Empresa" SERIAL NOT NULL,
    "Cargo_Empleado" VARCHAR(150),
    "Correo_Corporativo_Empleado" VARCHAR(255),
    "Id_Empresa" INTEGER NOT NULL,
    "Id_Persona" VARCHAR(20) NOT NULL,

    CONSTRAINT "T_Empleados_Empresas_pkey" PRIMARY KEY ("Id_Empleado_Empresa")
);

-- CreateTable
CREATE TABLE "T_Capacitacion_Varias_Personas_Naturales" (
    "Id_Capacitacion_Personas_Naturales" SERIAL NOT NULL,
    "Numero_Capacitacion_Segun_Curso" INTEGER NOT NULL,
    "Ruta_Informe_Final" VARCHAR(300) NOT NULL,
    "Celular" VARCHAR(20) NOT NULL,
    "Correo" VARCHAR(200),
    "Ruta_Foto" VARCHAR(300) NOT NULL,

    CONSTRAINT "T_Capacitacion_Varias_Personas_Naturales_pkey" PRIMARY KEY ("Id_Capacitacion_Personas_Naturales")
);

-- CreateTable
CREATE TABLE "T_Capacitacion_Persona_Natural" (
    "Id_Capacitacion_Persona_Natural" SERIAL NOT NULL,
    "Id_Capacitacion_Varias_Personas_Naturales" INTEGER NOT NULL,
    "Identificador_Persona" VARCHAR(20) NOT NULL,

    CONSTRAINT "T_Capacitacion_Persona_Natural_pkey" PRIMARY KEY ("Id_Capacitacion_Persona_Natural")
);

-- CreateTable
CREATE TABLE "T_Certificados" (
    "Id_Certificado" SERIAL NOT NULL,
    "Codigo_Certificado" VARCHAR(200) NOT NULL,
    "Tipo" "TipoCertificado" NOT NULL,
    "Id_Capacitacion_Persona_Natural" INTEGER,
    "Id_Capacitacion_Por_Empresa" INTEGER,

    CONSTRAINT "T_Certificados_pkey" PRIMARY KEY ("Id_Certificado")
);

-- CreateIndex
CREATE UNIQUE INDEX "T_Curso_Nombre_Completo_Curso_key" ON "T_Curso"("Nombre_Completo_Curso");

-- CreateIndex
CREATE UNIQUE INDEX "T_Curso_Abreviatura_key" ON "T_Curso"("Abreviatura");

-- CreateIndex
CREATE UNIQUE INDEX "T_Empresas_RUC_key" ON "T_Empresas"("RUC");

-- AddForeignKey
ALTER TABLE "T_Temas_Curso" ADD CONSTRAINT "T_Temas_Curso_Id_Curso_fkey" FOREIGN KEY ("Id_Curso") REFERENCES "T_Curso"("Id_Curso") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "T_Preguntas" ADD CONSTRAINT "T_Preguntas_Id_Curso_fkey" FOREIGN KEY ("Id_Curso") REFERENCES "T_Curso"("Id_Curso") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "T_Preguntas" ADD CONSTRAINT "T_Preguntas_Id_Tema_Curso_fkey" FOREIGN KEY ("Id_Tema_Curso") REFERENCES "T_Temas_Curso"("Id_Tema_Curso") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "T_Preguntas_Examenes" ADD CONSTRAINT "T_Preguntas_Examenes_Id_Pregunta_fkey" FOREIGN KEY ("Id_Pregunta") REFERENCES "T_Preguntas"("Id_Pregunta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "T_Preguntas_Examenes" ADD CONSTRAINT "T_Preguntas_Examenes_Id_Examen_fkey" FOREIGN KEY ("Id_Examen") REFERENCES "T_Examenes"("Id_Examen") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "T_Clases" ADD CONSTRAINT "T_Clases_Identificador_Instructor_fkey" FOREIGN KEY ("Identificador_Instructor") REFERENCES "T_Intructores"("Identificador_Instructor") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "T_Clases" ADD CONSTRAINT "T_Clases_Codigo_Curso_fkey" FOREIGN KEY ("Codigo_Curso") REFERENCES "T_Curso"("Id_Curso") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "T_Clases" ADD CONSTRAINT "T_Clases_Id_Examen_fkey" FOREIGN KEY ("Id_Examen") REFERENCES "T_Examenes"("Id_Examen") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "T_Capacitaciones_Por_Empresa" ADD CONSTRAINT "T_Capacitaciones_Por_Empresa_Id_Clase_fkey" FOREIGN KEY ("Id_Clase") REFERENCES "T_Clases"("Id_Clase") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "T_Capacitacion_Empleado_Empresa" ADD CONSTRAINT "T_Capacitacion_Empleado_Empresa_Id_Capacitacion_Empresa_fkey" FOREIGN KEY ("Id_Capacitacion_Empresa") REFERENCES "T_Capacitaciones_Por_Empresa"("Id_Capacitacion_Empresa") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "T_Capacitacion_Empleado_Empresa" ADD CONSTRAINT "T_Capacitacion_Empleado_Empresa_Id_Empleado_Empresa_fkey" FOREIGN KEY ("Id_Empleado_Empresa") REFERENCES "T_Empleados_Empresas"("Id_Empleado_Empresa") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "T_Empleados_Empresas" ADD CONSTRAINT "T_Empleados_Empresas_Id_Empresa_fkey" FOREIGN KEY ("Id_Empresa") REFERENCES "T_Empresas"("Id_Empresa") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "T_Empleados_Empresas" ADD CONSTRAINT "T_Empleados_Empresas_Id_Persona_fkey" FOREIGN KEY ("Id_Persona") REFERENCES "T_Personas"("Identificador_Persona") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "T_Capacitacion_Persona_Natural" ADD CONSTRAINT "T_Capacitacion_Persona_Natural_Id_Capacitacion_Varias_Pers_fkey" FOREIGN KEY ("Id_Capacitacion_Varias_Personas_Naturales") REFERENCES "T_Capacitacion_Varias_Personas_Naturales"("Id_Capacitacion_Personas_Naturales") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "T_Capacitacion_Persona_Natural" ADD CONSTRAINT "T_Capacitacion_Persona_Natural_Identificador_Persona_fkey" FOREIGN KEY ("Identificador_Persona") REFERENCES "T_Personas"("Identificador_Persona") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "T_Certificados" ADD CONSTRAINT "T_Certificados_Id_Capacitacion_Persona_Natural_fkey" FOREIGN KEY ("Id_Capacitacion_Persona_Natural") REFERENCES "T_Capacitacion_Persona_Natural"("Id_Capacitacion_Persona_Natural") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "T_Certificados" ADD CONSTRAINT "T_Certificados_Id_Capacitacion_Por_Empresa_fkey" FOREIGN KEY ("Id_Capacitacion_Por_Empresa") REFERENCES "T_Capacitaciones_Por_Empresa"("Id_Capacitacion_Empresa") ON DELETE SET NULL ON UPDATE CASCADE;
