import { AuthRequest } from '@/middleware/Auth';
import { error, prisma, success } from '@/Utils';
import { AttendanceStatus } from '@prisma/client';
import { Response } from 'express';
import logger from '@/config/logger';

const labourSelect = {
  id: true,
  name: true,
  phone: true,
  skills: true,
} as const;

/** Parse a YYYY-MM-DD (or ISO) string into a UTC date-only value, matching the DATE column. */
const parseDateOnly = (value: string): Date | null => {
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
};

/** Deduped list of workers on a project: team members + labours assigned to the project's tasks. */
const getWorkersForProject = async (projectId: string) => {
  const [teamPeoples, taskLabours] = await Promise.all([
    prisma.teamPeoples.findMany({
      where: { team: { Projects: { id: projectId } } },
      select: { labour: { select: labourSelect } },
    }),
    prisma.labours.findMany({
      where: { assignedTasks: { some: { projectId } } },
      select: labourSelect,
    }),
  ]);

  const workers = new Map<string, (typeof taskLabours)[number]>();
  for (const tp of teamPeoples) workers.set(tp.labour.id, tp.labour);
  for (const labour of taskLabours) workers.set(labour.id, labour);
  return [...workers.values()];
};

// Get the list of workers for a project, optionally with their attendance for a given date
export const getProjectWorkers = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { date } = req.query;

    const project = await prisma.projects.findUnique({
      where: { id: projectId as string },
    });
    if (!project) {
      return error(res, 'Project not found', 404);
    }

    const workers = await getWorkersForProject(projectId as string);

    if (!date) {
      return success(res, 'Project workers fetched successfully', workers);
    }

    const parsedDate = parseDateOnly(date as string);
    if (!parsedDate) {
      return error(res, 'date must be a valid date (YYYY-MM-DD)', 400);
    }

    const records = await prisma.attendance.findMany({
      where: { projectId: projectId as string, date: parsedDate },
    });
    const byLabourId = new Map(records.map((r) => [r.labourId, r]));

    const workersWithAttendance = workers.map((worker) => ({
      ...worker,
      attendance: byLabourId.get(worker.id) ?? null,
    }));

    return success(res, 'Project workers fetched successfully', workersWithAttendance);
  } catch (err: any) {
    logger.error(err);
    return error(res, 'Failed to fetch project workers', 400);
  }
};

// Mark (upsert) attendance for multiple workers of a project on a given date
export const markAttendance = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { date, records } = req.body;

    if (!date || !Array.isArray(records) || records.length === 0) {
      return error(res, 'Missing required fields: date and a non-empty records array', 400);
    }

    const parsedDate = parseDateOnly(date);
    if (!parsedDate) {
      return error(res, 'date must be a valid date (YYYY-MM-DD)', 400);
    }

    for (const record of records) {
      if (!record?.labourId || typeof record.labourId !== 'string') {
        return error(res, 'Each record must include a labourId', 400);
      }
      if (record.status !== AttendanceStatus.PRESENT && record.status !== AttendanceStatus.ABSENT) {
        return error(res, 'Each record status must be PRESENT or ABSENT', 400);
      }
    }

    const project = await prisma.projects.findUnique({
      where: { id: projectId as string },
    });
    if (!project) {
      return error(res, 'Project not found', 404);
    }

    const labourIds = [...new Set(records.map((r: any) => r.labourId as string))];
    const labourCount = await prisma.labours.count({ where: { id: { in: labourIds } } });
    if (labourCount !== labourIds.length) {
      return error(res, 'One or more labour ids are invalid', 404);
    }

    const saved = await prisma.$transaction(
      records.map((record: any) =>
        prisma.attendance.upsert({
          where: {
            projectId_labourId_date: {
              projectId: projectId as string,
              labourId: record.labourId,
              date: parsedDate,
            },
          },
          create: {
            projectId: projectId as string,
            labourId: record.labourId,
            date: parsedDate,
            status: record.status,
            description: record.description?.trim() || null,
            markedById: req.userId ?? null,
          },
          update: {
            status: record.status,
            description: record.description?.trim() || null,
            markedById: req.userId ?? null,
          },
          include: {
            labour: { select: labourSelect },
          },
        })
      )
    );

    return success(res, 'Attendance marked successfully', saved);
  } catch (err: any) {
    logger.error(err);
    return error(res, 'Failed to mark attendance', 400);
  }
};

// Get attendance for a project by single date or date range, grouped by date with summary counts
export const getAttendance = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { date, startDate, endDate } = req.query;

    const project = await prisma.projects.findUnique({
      where: { id: projectId as string },
    });
    if (!project) {
      return error(res, 'Project not found', 404);
    }

    let dateFilter: { equals?: Date; gte?: Date; lte?: Date };

    if (date) {
      const parsedDate = parseDateOnly(date as string);
      if (!parsedDate) {
        return error(res, 'date must be a valid date (YYYY-MM-DD)', 400);
      }
      dateFilter = { equals: parsedDate };
    } else if (startDate && endDate) {
      const parsedStart = parseDateOnly(startDate as string);
      const parsedEnd = parseDateOnly(endDate as string);
      if (!parsedStart || !parsedEnd) {
        return error(res, 'startDate and endDate must be valid dates (YYYY-MM-DD)', 400);
      }
      if (parsedStart > parsedEnd) {
        return error(res, 'startDate must be before or equal to endDate', 400);
      }
      dateFilter = { gte: parsedStart, lte: parsedEnd };
    } else {
      return error(res, 'Provide either date, or both startDate and endDate', 400);
    }

    const records = await prisma.attendance.findMany({
      where: { projectId: projectId as string, date: dateFilter },
      include: {
        labour: { select: labourSelect },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'asc' }],
    });

    const grouped = new Map<string, { date: string; present: number; absent: number; records: typeof records }>();
    for (const record of records) {
      const key = record.date.toISOString().split('T')[0] as string;
      let group = grouped.get(key);
      if (!group) {
        group = { date: key, present: 0, absent: 0, records: [] };
        grouped.set(key, group);
      }
      if (record.status === AttendanceStatus.PRESENT) group.present++;
      else group.absent++;
      group.records.push(record);
    }

    return success(res, 'Attendance fetched successfully', [...grouped.values()]);
  } catch (err: any) {
    logger.error(err);
    return error(res, 'Failed to fetch attendance', 400);
  }
};
