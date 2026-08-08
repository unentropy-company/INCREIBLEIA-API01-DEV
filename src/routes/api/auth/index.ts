import { Router } from "express";
import securityRouter from "./security";
import actualizarContrasenaRouter from "./contrasena";
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
  "/contrasena",
  isAdministradorAuthenticated,
  checkAuthentication,
  actualizarContrasenaRouter,
);

export default authRouter;
