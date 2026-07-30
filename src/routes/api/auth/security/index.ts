import { Router } from "express";
import activarTotpRouter from "./activar-totp";
import desactivarTotpRouter from "./desactivar-totp";

const securityRouter = Router();

securityRouter.use("/activar-totp", activarTotpRouter);
securityRouter.use("/desactivar-totp", desactivarTotpRouter);

export default securityRouter;
