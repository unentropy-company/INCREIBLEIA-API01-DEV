import swaggerJSDoc from "swagger-jsdoc";
import path from "path";
import { Entorno } from "../interfaces/shared/Entornos";

const entorno = process.env.ENTORNO || Entorno.LOCAL; // Fallback a "L" si no viene definida

// Configuración del servidor según el entorno
const getServerUrl = () => {
  switch (entorno) {
    case "P":
      return {
        url: "https://api.tudominio.com/api", // Ajusta con la URL real de Prod
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
  apis:
    entorno === Entorno.LOCAL
      ? ["./src/routes/**/*.ts", "./src/routes/*.ts"]
      : [
          path.join(process.cwd(), "src/routes/**/*.ts"),
          path.join(process.cwd(), "src/routes/*.ts"),
          path.join(__dirname, "../routes/**/*.js"),
        ],
};

export const swaggerSpec = swaggerJSDoc(options);
