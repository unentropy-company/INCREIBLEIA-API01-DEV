import { Router } from "express";
import securityRouter from "./security";

const authRouter = Router();

authRouter.use("/security", securityRouter);

export default authRouter;
