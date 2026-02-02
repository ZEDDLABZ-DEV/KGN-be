import {
  addItemToMaterialRequest,
  createMaterialRequest,
  deleteMaterialRequest,
  deleteMaterialRequestItem,
  getAllMaterialRequests,
  getMaterialRequestById,
  getMaterialRequestsByProject,
  updateMaterialRequest,
  updateMaterialRequestItem,
  updateMaterialRequestStatus,
} from '@/controllers/material-requests';
import { authorize } from '@/middleware/Permissions';
import { Router } from 'express';

const materialRequestRouter: any = Router();

// Material Request routes
materialRequestRouter.post(
  '/',
  authorize(['create_material_requests']),
  createMaterialRequest
);

materialRequestRouter.get(
  '/',
  authorize(['view_material_requests']),
  getAllMaterialRequests
);

materialRequestRouter.get(
  '/:id',
  authorize(['view_material_requests']),
  getMaterialRequestById
);

materialRequestRouter.get(
  '/project/:projectId',
  authorize(['view_material_requests']),
  getMaterialRequestsByProject
);

materialRequestRouter.put(
  '/:id',
  authorize(['update_material_requests']),
  updateMaterialRequest
);

materialRequestRouter.patch(
  '/:id/status',
  authorize(['update_material_requests']),
  updateMaterialRequestStatus
);

materialRequestRouter.delete(
  '/:id',
  authorize(['delete_material_requests']),
  deleteMaterialRequest
);

// Material Request Item routes
materialRequestRouter.post(
  '/:id/items',
  authorize(['update_material_requests']),
  addItemToMaterialRequest
);

materialRequestRouter.put(
  '/items/:itemId',
  authorize(['update_material_requests']),
  updateMaterialRequestItem
);

materialRequestRouter.delete(
  '/items/:itemId',
  authorize(['update_material_requests']),
  deleteMaterialRequestItem
);

export { materialRequestRouter };

