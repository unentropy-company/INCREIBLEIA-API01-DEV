import swaggerJSDoc from "swagger-jsdoc";

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
        url: "http://localhost:4002/api", 
        description: "Servidor local de desarrollo",
      },
      {
        url: "https://api.tudominio.com/api",
        description: "Servidor de producción",
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
  apis: ["./src/routes/**/*.ts", "./src/routes/*.ts"],
};

export const swaggerSpec = swaggerJSDoc(options);
