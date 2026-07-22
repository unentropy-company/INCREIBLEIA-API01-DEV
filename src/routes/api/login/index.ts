import { Router } from "express";

import loginAdministradorRouter from "./administrador";
import loginCuentaTemporalRouter from "./cuenta-temporal";

const loginRouter = Router();

loginRouter.use("/administrador", loginAdministradorRouter);
loginRouter.use("/cuenta-temporal", loginCuentaTemporalRouter);


export default loginRouter;
