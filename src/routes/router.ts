import { Router } from "express";
import { UserAuthenticatedAPI01 } from "../interfaces/shared/JWTPayload";
import { TiposUsuario } from "../interfaces/shared/TiposUsuario";
import AllErrorTypes from "../interfaces/shared/errors";
import { ErrorDetails } from "../interfaces/shared/errors/details";

import loginRouter from "./api/login";
import miPerfilRouter from "./api/mi-perfil";
// import checkAuthentication from "../middlewares/checkAuthentication";
import decodeType from "../middlewares/decodeType";
// import isAdministradorAuthenticated from "../middlewares/isAdministradorAuthenticated";
import authRouter from "./api/auth";

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

export default router;
