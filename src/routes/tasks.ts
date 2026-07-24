import {
  createTask,
  getAllTasks,
  getTaskById,
  updateTask,
  deleteTask,
  getMyTasks,
  getTasksCreatedByMe,
  getTasksByProjectId,
  addTaskUpdate,
  getTaskUpdates,
  getProjectTaskUpdates,
} from '@/controllers/tasks';
import { Router } from 'express';
import { upload } from '@/Utils';

const taskRouter: any = Router();

// Create a new task with file upload support
taskRouter.post('/', createTask);

// Get all tasks
taskRouter.get('/', getAllTasks);

// Get tasks assigned to current user
taskRouter.get('/my', getMyTasks);

// Get tasks created by current user
taskRouter.get('/created-by-me', getTasksCreatedByMe);

// Get task by ID
taskRouter.get('/:id', getTaskById);

// Update task
taskRouter.put('/:id', updateTask);

// Delete task
taskRouter.delete('/:id', deleteTask);

// Add a daily progress report for a task (optionally with images)
taskRouter.post('/:id/updates', upload.array('images', 10), addTaskUpdate);

// Get all daily progress reports for a task
taskRouter.get('/:id/updates', getTaskUpdates);

// Get all daily reports for every task in a project
taskRouter.get('/project/:projectId/updates', getProjectTaskUpdates);

// Get tasks by project id
taskRouter.get('/project/:projectId', getTasksByProjectId);
export { taskRouter };

