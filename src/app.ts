import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger";
import router from "./routes/router";
import { sqlInjectionPrevention } from "./middlewares/sqlInjectionPrevention";
import { swaggerAuth } from "./middlewares/swaggerAuth";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4002;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🔒 Ruta protegida de Swagger con Basic Auth
app.use(
  "/api-docs",
  swaggerAuth,
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec),
);

// 🛡️ Middleware de prevención SQL Injection y resto de rutas
app.use(
  "/api",
  sqlInjectionPrevention({
    enabled: true,
    logAttempts: true,
    blockSuspiciousRequests: true,
    checkHeaders: false,
    checkQueryParams: true,
    checkBody: true,
  }) as any,
  router,
);

app.use((req, res) => {
  res.status(404).json({
    message: `La ruta ${req.originalUrl} no existe en este servidor`,
  });
});

app.listen(PORT, () => {
  console.log(`Api ejecutándose en el puerto: ${PORT}`);
});
