import { AuthRequest } from '@/middleware/Auth';
import { created, error, generateProjectId, prisma, success } from '@/Utils';
import { TaskStatus } from '@prisma/client';
import { Response } from 'express';

export const createProject = async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      description,
      startDate,
      endDate,
      managerId,
      teamId,
      budget,
      location,
    } = req.body;

    const projectId = await generateProjectId(name);

    const proj = await prisma.projects.create({
      data: {
        createdById: req.userId as any,
        name,
        description,
        startDate,
        projectId,
        budget,
        location,
        endDate,
        managerId,
        teamId,
      },
    });

    return created(res, 'Project Created!', proj);
  } catch (err) {
    console.log(err);
    return error(res, 'Failed to create project', 400);
  }
};

export const getMyProjects = async (req: AuthRequest, res: Response) => {
  try {
    const { projectType } = req.query;

    let where: any;

    if (projectType === 'managed') {
      where = {
        managerId: req.userId as any,
      };
    } else if (projectType === 'created') {
      where = {
        createdById: req.userId as any,
      };
    } else {
      where = {
        OR: [
          { managerId: req.userId as any },
          { createdById: req.userId as any },
        ],
      };
    }

    const projs = await prisma.projects.findMany({
      where,
      include: {
        manager: {
          select: {
            id: true,
            name: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
            TeamPeoples: {
              select: {
                labour: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        tasks: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const projects = projs.map((project) => {
      const completedTasks = project.tasks.filter(
        (task) => task.status === TaskStatus.COMPLETED
      ).length;
      const totalTasks = project.tasks.length;

      delete (project as any)?.tasks;
      return {
        ...project,
        progress: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
        completedTasks,
        totalTasks,
      };
    });

    return success(res, 'My Projects Fetched', projects);
  } catch (err) {
    console.log(err);
    return error(res, 'Failed to fetch my projects', 400);
  }
};

// get all projects

export const getAllProjects = async (req: AuthRequest, res: Response) => {
  try {
    const projs = await prisma.projects.findMany({
      include: {
        manager: {
          select: {
            id: true,
            name: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
            TeamPeoples: {
              select: {
                labour: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        tasks: true,
      },
      orderBy: {
        createdAt: 'desc',
      }
    });

    const project = projs.map((project) => {

      const completedTasks = project.tasks.filter(
        (task) => task.status === TaskStatus.COMPLETED
      ).length;
      const totalTasks = project.tasks.length;

      delete (project as any)?.tasks;
      return {
        ...project,
        progress: (completedTasks / totalTasks) * 100,
        completedTasks,
        totalTasks
      };
    });

    return success(res, 'All Projects Fetched', project);
  } catch (err) {
    console.log(err);
    return error(res, 'Failed to get all projects', 400);
  }
};

export const updateProject = async (req: AuthRequest, res: Response) => {
  try {
    const data = req.body;

    await prisma.projects.update({
      where: {
        id: req.params.id as any,
      },
      data,
    });
    return success(res, 'Project updated successfully');
  } catch (err) {
    console.log(err);
    return error(res, 'Failed to update project', 400);
  }
};