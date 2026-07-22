import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import router from "./routes/router";
import { sqlInjectionPrevention } from "./middlewares/sqlInjectionPrevention";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 4001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🛡️ Middleware de prevención SQL Injection
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

// Ruta de 404 NOT FOUND
app.use((req, res) => {
  res.status(404).json({
    message: `La ruta ${req.originalUrl} no existe en este servidor`,
  });
});

app.listen(PORT, () => {
  console.log(`Api ejecutandose en el puerto: ${PORT}`);
});
