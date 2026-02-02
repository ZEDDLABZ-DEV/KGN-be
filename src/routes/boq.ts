import {
  uploadBoq,
  downloadBoq,
  getBoqsByProject,
  getBoqById,
  getBoqFileByProject,
} from '@/controllers/boq';
import { authorize } from '@/middleware/Permissions';
import { upload } from '@/Utils';
import { Router } from 'express';

const boqRouter: any = Router();

// Upload BOQ file
boqRouter.post(
  '/upload',
  // authorize(['create_boqs']),
  upload.single('file'),
  uploadBoq
);

// Download BOQ file (returns signed URL)
boqRouter.get('/download/:id', downloadBoq);

// Get all BOQs for a project
boqRouter.get('/project/:projectId', getBoqsByProject);

// Get BOQ file from project (returns latest BOQ with download URL)
boqRouter.get('/project/:projectId/file', getBoqFileByProject);

// Get single BOQ by ID
boqRouter.get('/:id', getBoqById);

export { boqRouter };

