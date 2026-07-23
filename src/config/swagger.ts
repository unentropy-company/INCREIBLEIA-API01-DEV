import swaggerJSDoc from "swagger-jsdoc";
import path from "path";

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "API01 Increible IA",
      version: "1.0.0",
      description:
        "Documentación oficial de los endpoints de la API01 de la Plataforma de Certificaciones de Increible IA",
    },
    servers: [
      {
        url: "https://increibleia-api01-dev.vercel.app/api",
        description: "Servidor Vercel (Dev)",
      },
      {
        url: "http://localhost:4002/api",
        description: "Servidor local de desarrollo",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  // 📌 Uso de path.resolve/path.join para soportar .ts (local) y .js (Vercel/Producción)
  apis: [
    path.join(process.cwd(), "src/routes/**/*.ts"),
    path.join(process.cwd(), "src/routes/*.ts"),
    path.join(__dirname, "../routes/**/*.ts"),
    path.join(__dirname, "../routes/**/*.js"),
  ],
};

export const swaggerSpec = swaggerJSDoc(options);