import {
  createTask,
  getAllTasks,
  getTaskById,
  updateTask,
  deleteTask,
  getMyTasks,
  getTasksCreatedByMe,
  getTasksByProjectId,
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

// Get tasks by project id
taskRouter.get('/project/:projectId', getTasksByProjectId);
export { taskRouter };

