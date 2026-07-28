import { AuthRequest } from '@/middleware/Auth';
import { error, prisma, success } from '@/Utils';
import { Response } from 'express';
import logger from '@/config/logger';

// Main dashboard stats
export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();

    const [
      // Top-level counts
      totalProjects,
      activeProjects,
      totalTasks,
      overdueTasks,
      completedTasks,
      totalTeams,
      totalLabours,
      totalUsers,
      activeVendors,

      // Procurement pipeline
      pendingMRs,
      approvedMRs,
      approvedPOs,
      sentPOs,
      totalPOAmount,
      pendingGRNs,
      completedGRNs,

      // Inventory
      totalInventoryItems,

      // Recent projects
      recentProjects,

      // Upcoming due tasks
      upcomingTasks,
    ] = await Promise.all([
      // ── Top Cards ──
      prisma.projects.count(),
      prisma.projects.count({ where: { status: 'INPROGRESS' } }),
      prisma.tasks.count(),
      prisma.tasks.count({
        where: { dueDate: { lt: now }, status: { notIn: ['COMPLETED'] } },
      }),
      prisma.tasks.count({ where: { status: 'COMPLETED' } }),
      prisma.teams.count(),
      prisma.labours.count(),
      prisma.user.count(),
      prisma.vendor.count({ where: { status: 'ACTIVE' } }),

      // ── Procurement Pipeline ──
      prisma.materialRequest.count({ where: { status: 'PENDING' } }),
      prisma.materialRequest.count({ where: { status: 'APPROVED' } }),
      prisma.purchaseOrder.count({ where: { status: 'APPROVED' } }),
      prisma.purchaseOrder.count({ where: { status: 'SENT' } }),
      prisma.purchaseOrder.aggregate({ _sum: { totalAmount: true } }),
      prisma.gRN.count({ where: { status: 'PENDING' } }),
      prisma.gRN.count({ where: { status: 'COMPLETED' } }),

      // ── Inventory ──
      prisma.inventoryItem.count(),

      // ── Recent Projects (latest 5) ──
      prisma.projects.findMany({
        take: 5,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          projectId: true,
          status: true,
          location: true,
          startDate: true,
          endDate: true,
          manager: { select: { id: true, name: true } },
          _count: { select: { tasks: true, materialRequests: true } },
        },
      }),

      // ── Upcoming / Overdue Tasks (next 7 days + overdue) ──
      prisma.tasks.findMany({
        take: 10,
        where: {
          status: { notIn: ['COMPLETED'] },
          dueDate: { lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { dueDate: 'asc' },
        select: {
          id: true,
          name: true,
          status: true,
          priority: true,
          dueDate: true,
          project: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      }),
    ]);

    const stats = {
      // ── Overview Cards ──
      overview: {
        projects: { total: totalProjects, active: activeProjects },
        tasks: { total: totalTasks, completed: completedTasks, overdue: overdueTasks },
        teams: totalTeams,
        labours: totalLabours,
        users: totalUsers,
        vendors: activeVendors,
      },

      // ── Procurement Pipeline ──
      procurement: {
        pipeline: {
          pendingApproval: pendingMRs,
          awaitingPO: approvedMRs,
          awaitingDispatch: approvedPOs,
          awaitingDelivery: sentPOs,
          awaitingInspection: pendingGRNs,
          completedGRNs: completedGRNs,
        },
        totalPOAmount: totalPOAmount._sum.totalAmount || 0,
      },

      // ── Inventory ──
      inventory: {
        totalItems: totalInventoryItems,
      },

      // ── Recent Projects ──
      recentProjects,

      // ── Upcoming / Overdue Tasks ──
      upcomingTasks: upcomingTasks.map((t) => ({
        ...t,
        isOverdue: new Date(t.dueDate) < now,
      })),
    };

    return success(res, 'Dashboard stats fetched successfully', stats);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to fetch dashboard stats', 500);
  }
};

// Project-specific dashboard stats
export const getProjectDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const now = new Date();

    const project = await prisma.projects.findUnique({
      where: { id: projectId as string },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            _count: { select: { TeamPeoples: true } },
          },
        },
        manager: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!project) {
      return error(res, 'Project not found', 404);
    }

    const pid = projectId as string;

    const [
      tasksByStatus,
      overdueTasks,
      tasksByPriority,
      mrByStatus,
      purchaseOrders,
      inventoryItemIds,
      boqCount,
      filesCount,
      recentTasks,
    ] = await Promise.all([
      prisma.tasks.groupBy({
        by: ['status'],
        where: { projectId: pid },
        _count: true,
      }),
      prisma.tasks.count({
        where: { projectId: pid, dueDate: { lt: now }, status: { notIn: ['COMPLETED'] } },
      }),
      prisma.tasks.groupBy({
        by: ['priority'],
        where: { projectId: pid },
        _count: true,
      }),
      prisma.materialRequest.groupBy({
        by: ['status'],
        where: { projectId: pid },
        _count: true,
      }),
      prisma.purchaseOrder.findMany({
        where: { materialRequest: { projectId: pid } },
        select: { status: true, totalAmount: true },
      }),
      prisma.stockMovement.findMany({
        where: { projectId: pid },
        select: { inventoryItemId: true },
        distinct: ['inventoryItemId'],
      }),
      prisma.bOQ.count({ where: { projectId: pid } }),
      prisma.projectFiles.count({ where: { projectId: pid } }),
      prisma.tasks.findMany({
        take: 5,
        where: { projectId: pid },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          status: true,
          priority: true,
          dueDate: true,
          assignedTo: { select: { id: true, name: true } },
        },
      }),
    ]);

    // Calculations
    const totalTasks = tasksByStatus.reduce((sum, item) => sum + item._count, 0);
    const completedTasks = tasksByStatus.find((t) => t.status === 'COMPLETED')?._count || 0;
    const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const poTotal = purchaseOrders.length;
    const poTotalAmount = purchaseOrders.reduce((sum, po) => sum + po.totalAmount, 0);
    const poByStatus: any = {};
    purchaseOrders.forEach((po) => {
      poByStatus[po.status] = (poByStatus[po.status] || 0) + 1;
    });

    // Time progress
    const start = new Date(project.startDate);
    const end = new Date(project.endDate);
    const totalDuration = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    const timeProgress = totalDuration > 0 ? Math.min(Math.round((elapsed / totalDuration) * 100), 100) : 0;

    const stats = {
      project: {
        id: project.id,
        name: project.name,
        projectId: project.projectId,
        status: project.status,
        location: project.location,
        budget: project.budget,
        startDate: project.startDate,
        endDate: project.endDate,
        manager: project.manager,
        team: project.team,
      },
      progress: {
        timeProgress,
        taskCompletionRate,
      },
      tasks: {
        total: totalTasks,
        completed: completedTasks,
        overdue: overdueTasks,
        byStatus: tasksByStatus.reduce((acc: any, item) => {
          acc[item.status] = item._count;
          return acc;
        }, {}),
        byPriority: tasksByPriority.reduce((acc: any, item) => {
          acc[item.priority] = item._count;
          return acc;
        }, {}),
      },
      procurement: {
        materialRequests: {
          total: mrByStatus.reduce((sum, item) => sum + item._count, 0),
          byStatus: mrByStatus.reduce((acc: any, item) => {
            acc[item.status] = item._count;
            return acc;
          }, {}),
        },
        purchaseOrders: {
          total: poTotal,
          totalAmount: poTotalAmount,
          byStatus: poByStatus,
        },
      },
      inventory: {
        totalItems: inventoryItemIds.length,
      },
      boqs: boqCount,
      files: filesCount,
      recentTasks,
    };

    return success(res, 'Project dashboard stats fetched successfully', stats);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to fetch project dashboard stats', 500);
  }
};

// Recent activity across the system
export const getRecentActivity = async (req: AuthRequest, res: Response) => {
  try {
    const { limit = '20' } = req.query;
    const take = parseInt(limit as string);

    const [recentTasks, recentMRs, recentPOs, recentGRNs, recentInventory] =
      await Promise.all([
        prisma.tasks.findMany({
          take,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            name: true,
            status: true,
            priority: true,
            updatedAt: true,
            project: { select: { id: true, name: true } },
          },
        }),
        prisma.materialRequest.findMany({
          take,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            updatedAt: true,
            project: { select: { id: true, name: true } },
          },
        }),
        prisma.purchaseOrder.findMany({
          take,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            poNumber: true,
            status: true,
            totalAmount: true,
            vendorName: true,
            updatedAt: true,
            vendor: { select: { id: true, name: true } },
          },
        }),
        prisma.gRN.findMany({
          take,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            grnNumber: true,
            status: true,
            receivedDate: true,
            receivedBy: true,
            updatedAt: true,
          },
        }),
        prisma.stockMovement.findMany({
          take,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            type: true,
            quantity: true,
            referenceType: true,
            referenceId: true,
            notes: true,
            createdAt: true,
            inventoryItem: { select: { id: true, name: true, unit: true } },
          },
        }),
      ]);

    const activities: any[] = [
      ...recentTasks.map((t) => ({
        type: 'TASK',
        id: t.id,
        title: t.name,
        status: t.status,
        project: t.project,
        date: t.updatedAt,
      })),
      ...recentMRs.map((mr) => ({
        type: 'MATERIAL_REQUEST',
        id: mr.id,
        title: mr.title,
        status: mr.status,
        project: mr.project,
        date: mr.updatedAt,
      })),
      ...recentPOs.map((po) => ({
        type: 'PURCHASE_ORDER',
        id: po.id,
        title: po.poNumber,
        status: po.status,
        vendor: po.vendor?.name || po.vendorName,
        totalAmount: po.totalAmount,
        date: po.updatedAt,
      })),
      ...recentGRNs.map((grn) => ({
        type: 'GRN',
        id: grn.id,
        title: grn.grnNumber,
        status: grn.status,
        receivedBy: grn.receivedBy,
        date: grn.updatedAt,
      })),
      ...recentInventory.map((movement) => ({
        type: 'INVENTORY',
        id: movement.id,
        title: movement.inventoryItem.name,
        movementType: movement.type,
        quantity: movement.quantity,
        unit: movement.inventoryItem.unit,
        reference: `${movement.referenceType}:${movement.referenceId}`,
        date: movement.createdAt,
      })),
    ];

    activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return success(res, 'Recent activity fetched successfully', activities.slice(0, take));
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to fetch recent activity', 500);
  }
};
