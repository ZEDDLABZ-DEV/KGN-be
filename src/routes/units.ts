import { Router } from 'express';
import { authorize } from '@/middleware/Permissions';
import { createUnit, getAllUnits, updateUnit, updateUnitStatus, deleteUnit } from '@/controllers/units';

const unitRouter: any = Router();

// Create unit
unitRouter.post('/', authorize(['create_units']), createUnit);

// List units (?status=ACTIVE|INACTIVE|ALL, default ACTIVE) — any authenticated user
unitRouter.get('/', getAllUnits);

// Rename unit
unitRouter.put('/:id', authorize(['update_units']), updateUnit);

// Set unit status
unitRouter.patch('/:id/status', authorize(['update_units']), updateUnitStatus);

// Delete unit
unitRouter.delete('/:id', authorize(['delete_units']), deleteUnit);

export { unitRouter };
