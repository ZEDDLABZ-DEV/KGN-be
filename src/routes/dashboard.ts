import { Router } from 'express';
import {
  getDashboardStats,
  getProjectDashboardStats,
  getRecentActivity,
} from '@/controllers/dashboard';

const router: any = Router();

// Main dashboard stats (overall) — includes procurement pipeline
router.get('/stats', getDashboardStats);

// Project-specific dashboard stats
router.get('/project/:projectId', getProjectDashboardStats);

// Recent activity feed
router.get('/recent-activity', getRecentActivity);

export default router;
