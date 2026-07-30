import swaggerJSDoc from "swagger-jsdoc";
import path from "path";
import { Entorno } from "../interfaces/shared/Entornos";

const entorno = process.env.ENTORNO || Entorno.LOCAL;

const getServerUrl = () => {
  switch (entorno) {
    case "P":
      return {
        url: "https://api.tudominio.com/api",
        description: "Servidor de Producción",
      };
    case "D":
      return {
        url: "https://increibleia-api01-dev.vercel.app/api",
        description: "Servidor Vercel (Desarrollo)",
      };
    case "L":
    default:
      return {
        url: "http://localhost:4002/api",
        description: "Servidor Local",
      };
  }
};

// Normaliza rutas de Windows (\) a formato POSIX (/) que Glob requiere
const formatGlobPath = (targetPath: string) => targetPath.replace(/\\/g, "/");

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "API01 Increible IA",
      version: "1.0.0",
      description:
        "Documentación oficial de los endpoints de la API01 de la Plataforma de Certificaciones de Increible IA",
    },
    servers: [getServerUrl()],
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
  apis: [
    // 1. Patrón relativo universal (cubre cualquier nivel de profundidad e index.ts)
    "./src/routes/**/*.{ts,js}",
    "./src/routes/**/index.{ts,js}",

    // 2. Patrones absolutos normalizados para Windows / Linux
    formatGlobPath(path.join(process.cwd(), "src/routes/**/*.{ts,js}")),
    formatGlobPath(path.join(process.cwd(), "dist/routes/**/*.{ts,js}")),
    formatGlobPath(path.join(__dirname, "../routes/**/*.{ts,js}")),
  ],
};

export const swaggerSpec = swaggerJSDoc(options);
