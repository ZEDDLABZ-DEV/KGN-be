import { addLabour, getAllManagers, getLabours, getUserById, getUsers, updateLabour, updateUser } from "@/controllers/users";
import { Router } from "express";

const userRouter:any = Router();

userRouter.get("/", getUsers);
userRouter.get("/:id", getUserById);
userRouter.put('/:id', updateUser);
userRouter.post('/labour', addLabour);
userRouter.put('/labour/:id', updateLabour);
userRouter.get('/list/labours', getLabours);
userRouter.get('/list/managers', getAllManagers);

export {userRouter};
