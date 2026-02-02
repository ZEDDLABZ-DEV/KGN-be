import { AuthRequest } from '@/middleware/Auth';
import { created, error, prisma, success } from '@/Utils';
import { Response } from 'express';

export const createTeam = async (req: AuthRequest, res: Response) => {
  try {
    const { name, leadId, description, labourIds } = req.body;

    const team = await prisma.teams.create({
      data: {
        name,
        description,
        leadId,
        createdById: req.userId as any,
      },
    });

    if (!team) return error(res, 'Failed to create team', 400);

    const temaMembers = await prisma.teamPeoples.createMany({
      data: labourIds.map((lbr: any) => ({ labourId: lbr, teamId: team.id })),
    });

    if (!temaMembers || labourIds.length === 0)
      return created(res, 'Team Created with no members', team);

    return created(
      res,
      `Team ${name} created with ${labourIds.length} members`,
      team
    );
  } catch (err) {
    console.log(err);
    return error(res, 'Failed to create a team', 400);
  }
};

export const addTeamMember = async (req: AuthRequest, res: Response) => {
  try {
    const { labourIds, teamId } = req.body;

    const members = await prisma.teamPeoples.createMany({
      data: labourIds.map((lbr: any) => ({ labourId: lbr, teamId })),
    });

    return success(res, 'Team members added', members);
  } catch (err) {
    console.log(err);
    return error(res, 'Failed to add team member', 400);
  }
};

export const getAllTeams = async (req: AuthRequest, res: Response) => {
  try {
    const teams = await prisma.teams.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        lead: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            TeamPeoples: true,
          },
        },
      },
    });

    return success(res, 'Team Fetched', teams);
  } catch (err) {
    console.log(err);
    return error(res, 'Failed to fetch teams', 400);
  }
};

export const assignProject = async(req:AuthRequest, res:Response) => {
    try {

        const {projectId, teamId} = req.body;

        await prisma.projects.update({
            data: {
                teamId
            },
            where: {
                id: projectId
            }
        });

        return success(res, "Project Assigned to team")
        
    } catch (err) {
        console.log(err);
        return error(res, 'Failed to assign project to team', 400);
    }
}

export const getTeamMembers = async (req: AuthRequest, res: Response) => {
  try {
    const { teamId } = req.params;
    if (!teamId) return error(res, 'Team ID is required', 400);
    const members = await prisma.teamPeoples.findMany({
      where: { teamId },
      include: {
        labour: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    const teamMembers = members.map((member) => member.labour);
    return success(res, 'Team members fetched', teamMembers);
  }
  catch (err) {
    console.log(err);
    return error(res, 'Failed to fetch team members', 400);
  }
}

export const deleteTeam = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    // Check if team is assigned to any project
    const teamWithProject = await prisma.projects.findFirst({
      where: { teamId: id },
    });
    
    if (teamWithProject) {
      return error(res, 'Cannot delete team. Team is assigned to a project', 400);
    }
    
    const team = await prisma.teams.delete({
      where: { id },
    });
    return success(res, 'Team deleted successfully', team);
  } catch (err) {
    console.log(err);
    return error(res, 'Failed to delete team', 400);
  }
}

export const removeTeamMember = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { labourId } = req.body;
    const teamMember = await prisma.teamPeoples.delete({
      where: { id: labourId, teamId: id },
    });
    return success(res, 'Team member removed successfully', teamMember);
  } catch (err) {
    console.log(err);
    return error(res, 'Failed to remove team member', 400);
  }
}

export const unassignProject = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.body;
    const project = await prisma.projects.update({
      where: { id: projectId },
      data: { teamId: null },
    });
    return success(res, 'Project unassigned from team', project);
  } catch (err) {
    console.log(err);
    return error(res, 'Failed to unassign project from team', 400);
  }
}