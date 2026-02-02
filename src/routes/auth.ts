import { authLogin, createPassword, me, signup } from "@/controllers/auth";
import { Router } from "express";

const authRouter:any  = Router()

authRouter.post("/signup", signup);
authRouter.post("/login", authLogin);
authRouter.post("/create-password", createPassword);
authRouter.get("/me", me);

export {authRouter}