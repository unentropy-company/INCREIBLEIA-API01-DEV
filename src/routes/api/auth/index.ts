import { Router } from "express";
import securityRouter from "./security";
import actualizarContrasenaRouter from "./contraseña";
import checkAuthentication from "../../../middlewares/checkAuthentication";
import isAdministradorAuthenticated from "../../../middlewares/isAdministradorAuthenticated";

const authRouter = Router();

authRouter.use(
  "/security",
  isAdministradorAuthenticated,
  checkAuthentication,
  securityRouter,
);

authRouter.use(
  "/contraseña",
  isAdministradorAuthenticated,
  checkAuthentication,
  actualizarContrasenaRouter,
);

export default authRouter;
