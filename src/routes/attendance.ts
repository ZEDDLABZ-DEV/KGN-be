import { getProjectWorkers, markAttendance, getAttendance } from '@/controllers/attendance';
import { authorize } from '@/middleware/Permissions';
import { Router } from 'express';

const attendanceRouter: any = Router();

// Get project workers (team members + task-assigned labours), optionally with attendance for ?date=
attendanceRouter.get('/project/:projectId/workers', authorize(['mark_attendance']), getProjectWorkers);

// Mark (upsert) attendance for workers of a project on a date
attendanceRouter.post('/project/:projectId', authorize(['mark_attendance']), markAttendance);

// Get attendance by ?date= or ?startDate=&endDate=
attendanceRouter.get('/project/:projectId', authorize(['view_attendance']), getAttendance);

export { attendanceRouter };
