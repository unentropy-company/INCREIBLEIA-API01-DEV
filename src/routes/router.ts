import { Router } from "express";
import { UserAuthenticatedAPI01 } from "../interfaces/shared/JWTPayload";
import { TiposUsuario } from "../interfaces/shared/TiposUsuario";
import AllErrorTypes from "../interfaces/shared/errors";
import { ErrorDetails } from "../interfaces/shared/errors/details";

import loginRouter from "./api/login";
import miPerfilRouter from "./api/mi-perfil";
import decodeType from "../middlewares/decodeType";
import authRouter from "./api/auth";
import clientesRouter from "./api/clientes";
// import checkAuthentication from "../middlewares/checkAuthentication";
// import isAdministradorAuthenticated from "../middlewares/isAdministradorAuthenticated";

const router = Router();

// Extender la interfaz Request de Express
declare global {
  namespace Express {
    interface Request {
      user?: UserAuthenticatedAPI01;
      isAuthenticated?: boolean;
      userType?: TiposUsuario;
      authError?: {
        type: AllErrorTypes;
        message: string;
        details?: ErrorDetails;
      };
    }
  }
}

router.use("/login", loginRouter);

router.use("/mi-perfil", decodeType, miPerfilRouter);

router.use("/auth", decodeType, authRouter);

router.use("/clientes", decodeType, clientesRouter);

export default router;
