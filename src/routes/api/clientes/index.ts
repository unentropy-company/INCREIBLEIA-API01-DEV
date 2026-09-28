import { Router } from "express";
import personasRouter from "./personas";
import empresasRouter from "./empresas";

const clientesRouter = Router();

clientesRouter.use("/personas", personasRouter);
clientesRouter.use("/empresas", empresasRouter);

export default clientesRouter;
