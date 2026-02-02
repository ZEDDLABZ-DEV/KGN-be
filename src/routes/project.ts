import { createProject, getAllProjects, getMyProjects, updateProject } from "@/controllers/projects";
import { authorize } from "@/middleware/Permissions";
import { Router } from "express";

const projectRouter:any = Router();

projectRouter.get("/", getMyProjects);

projectRouter.post("/", authorize(['create_projects']), createProject);

projectRouter.get("/all", authorize(['view_projects']), getAllProjects);

projectRouter.put("/:id", authorize(['update_projects']), updateProject);

export { projectRouter };
