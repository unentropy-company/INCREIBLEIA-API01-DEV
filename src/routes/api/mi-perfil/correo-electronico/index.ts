import { Router } from "express";
import solicitarCambioCorreoRouter from "./solicitar-cambio";
import confirmarCambioCorreoRouter from "./confirmar-cambio";

const CorreoElectronicoRouter = Router();

CorreoElectronicoRouter.use("/solicitar-cambio", solicitarCambioCorreoRouter);
CorreoElectronicoRouter.use("/confirmar-cambio", confirmarCambioCorreoRouter);

export default CorreoElectronicoRouter;
