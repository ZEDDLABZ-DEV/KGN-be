
import { uploadBoq } from "@/controllers/Ai";
import { upload } from "@/Utils";
import { Router } from "express";

const aiRouter:any  = Router()

aiRouter.post("/", upload.single("file"), uploadBoq);

export {aiRouter}