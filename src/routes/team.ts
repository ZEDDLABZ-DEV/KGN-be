import { Router } from "express";
import { addTeamMember, assignProject, createTeam, getAllTeams, getTeamMembers } from "@/controllers/team";
const teamRouter:any = Router();


teamRouter.post("/", createTeam);

teamRouter.get("/all", getAllTeams);

teamRouter.post("/add-member", addTeamMember);

teamRouter.put("/assign-project", assignProject);

teamRouter.get("/members/:teamId", getTeamMembers);

export { teamRouter };