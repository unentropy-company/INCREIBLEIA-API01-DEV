import { Router } from "express";
import { UserAuthenticatedAPI01 } from "../interfaces/shared/JWTPayload";
import { TiposUsuario } from "../interfaces/shared/TiposUsuario";
import AllErrorTypes from "../interfaces/shared/errors";
import { ErrorDetails } from "../interfaces/shared/errors/details";

import loginRouter from "./api/login";

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

export default router;
