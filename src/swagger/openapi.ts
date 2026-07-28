const bearerAuth = [{ bearerAuth: [] }];

const successResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    message: { type: 'string' },
    data: {},
  },
};

const errorResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    message: { type: 'string' },
  },
};

const idParam = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string' },
};

const projectIdParam = {
  name: 'projectId',
  in: 'path',
  required: true,
  schema: { type: 'string' },
};

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'KGN Construction Management API',
    version: '1.0.0',
    description:
      'API documentation for the KGN Construction Group backend. Most endpoints require a JWT Bearer token obtained from `/v1/api/auth/login`.',
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Local development' },
    { url: 'https://api.constructiongroupofcompanies.com', description: 'Production' },
  ],
  tags: [
    { name: 'Health' },
    { name: 'Auth' },
    { name: 'Users' },
    { name: 'Projects' },
    { name: 'Teams' },
    { name: 'Tasks' },
    { name: 'Roles & Permissions' },
    { name: 'Material Requests' },
    { name: 'AI' },
    { name: 'BOQ' },
    { name: 'Files' },
    { name: 'Purchase Orders' },
    { name: 'GRN' },
    { name: 'Vendors' },
    { name: 'Inventory' },
    { name: 'Units' },
    { name: 'Dashboard' },
    { name: 'Attendance' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token from login endpoint',
      },
    },
    schemas: {
      SuccessResponse: successResponse,
      ErrorResponse: errorResponse,
      LoginRequest: {
        type: 'object',
        required: ['login', 'password'],
        properties: {
          login: { type: 'string', example: 'user@example.com' },
          password: { type: 'string', example: 'password123' },
        },
      },
      SignupRequest: {
        type: 'object',
        required: ['email', 'password', 'name', 'phone', 'gender', 'roleId'],
        properties: {
          email: { type: 'string' },
          password: { type: 'string' },
          name: { type: 'string' },
          phone: { type: 'string' },
          gender: { type: 'string' },
          roleId: { type: 'string' },
          dateOfBirth: { type: 'string' },
          loginWith: { type: 'string', enum: ['EMAIL', 'PHONE'] },
        },
      },
      CreatePasswordRequest: {
        type: 'object',
        required: ['password', 'userId'],
        properties: {
          password: { type: 'string' },
          userId: { type: 'string' },
        },
      },
      ChangePasswordRequest: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string' },
          newPassword: { type: 'string' },
        },
      },
      CreateProjectRequest: {
        type: 'object',
        required: ['name', 'description', 'startDate', 'endDate', 'budget', 'location'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
          managerId: { type: 'string', nullable: true, description: 'Optional project manager user ID' },
          teamId: { type: 'string', nullable: true },
          budget: { type: 'string' },
          location: { type: 'string' },
        },
      },
      CreateTaskRequest: {
        type: 'object',
        required: ['name', 'description', 'dueDate', 'projectId', 'assignedToIds'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          dueDate: { type: 'string', format: 'date-time' },
          projectId: { type: 'string' },
          assignedToIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Labour IDs to assign (accepts single id via assignedToId as well)',
          },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
          status: { type: 'string', enum: ['NOTSTARTED', 'INPROGRESS', 'COMPLETED', 'ONHOLD'] },
          taskProgress: { type: 'integer', minimum: 0, maximum: 100 },
        },
      },
      UpdateTaskRequest: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          dueDate: { type: 'string', format: 'date-time' },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
          status: { type: 'string', enum: ['NOTSTARTED', 'INPROGRESS', 'COMPLETED', 'ONHOLD'] },
          taskProgress: { type: 'integer' },
          attachments: { type: 'array', items: { type: 'string' } },
          updates: { type: 'string', description: 'Legacy inline update string (pushed to updates array)' },
          assignedToIds: { type: 'array', items: { type: 'string' } },
        },
      },
      TaskUpdateRequest: {
        type: 'object',
        required: ['reportDate', 'progressUpdate'],
        properties: {
          reportDate: { type: 'string', format: 'date-time' },
          progressUpdate: { type: 'string' },
        },
      },
      TaskUpdateMultipartRequest: {
        type: 'object',
        required: ['reportDate', 'progressUpdate'],
        properties: {
          reportDate: { type: 'string', format: 'date-time' },
          progressUpdate: { type: 'string' },
          images: {
            type: 'array',
            items: { type: 'string', format: 'binary' },
            description: 'Optional images (max 10)',
          },
        },
      },
      TaskUpdate: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          taskId: { type: 'string' },
          reportDate: { type: 'string', format: 'date-time' },
          progressUpdate: { type: 'string' },
          images: { type: 'array', items: { type: 'string' }, description: 'Signed image URLs (valid for 1 hour)' },
          createdById: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateTeamRequest: {
        type: 'object',
        required: ['name', 'leadId', 'description'],
        properties: {
          name: { type: 'string' },
          leadId: { type: 'string' },
          description: { type: 'string' },
          labourIds: { type: 'array', items: { type: 'string' } },
        },
      },
      AddTeamMemberRequest: {
        type: 'object',
        required: ['labourId', 'teamId'],
        properties: {
          labourId: { type: 'string' },
          teamId: { type: 'string' },
        },
      },
      AssignProjectRequest: {
        type: 'object',
        required: ['projectId', 'teamId'],
        properties: {
          projectId: { type: 'string' },
          teamId: { type: 'string' },
        },
      },
      CreateLabourRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          phone: { type: 'string' },
          email: { type: 'string' },
          skills: { type: 'array', items: { type: 'string' } },
          experience: { type: 'string' },
        },
      },
      CreateRoleRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
        },
      },
      CreatePermissionRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
        },
      },
      AssignPermissionsRequest: {
        type: 'object',
        required: ['roleId', 'permissionIds'],
        properties: {
          roleId: { type: 'string' },
          permissionIds: { type: 'array', items: { type: 'string' } },
        },
      },
      AssignRoleRequest: {
        type: 'object',
        required: ['userId', 'roleId'],
        properties: {
          userId: { type: 'string' },
          roleId: { type: 'string' },
        },
      },
      MaterialRequestItemInput: {
        type: 'object',
        properties: {
          itemName: { type: 'string' },
          quantity: { type: 'number' },
          unit: { type: 'string' },
          estimatedCost: { type: 'number' },
          remarks: { type: 'string' },
        },
      },
      CreateMaterialRequest: {
        type: 'object',
        required: ['projectId', 'title'],
        properties: {
          projectId: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/MaterialRequestItemInput' },
          },
        },
      },
      StatusUpdate: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string' },
        },
      },
      CreatePurchaseOrderRequest: {
        type: 'object',
        required: ['materialRequestId'],
        properties: {
          materialRequestId: { type: 'string' },
          vendorId: { type: 'string' },
          vendorName: { type: 'string' },
          vendorContact: { type: 'string' },
          vendorEmail: { type: 'string' },
          vendorAddress: { type: 'string' },
          notes: { type: 'string' },
          expectedDelivery: { type: 'string', format: 'date-time' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                itemName: { type: 'string' },
                description: { type: 'string' },
                quantity: { type: 'number' },
                unit: { type: 'string' },
                unitPrice: { type: 'number' },
              },
            },
          },
        },
      },
      POItemInput: {
        type: 'object',
        properties: {
          itemName: { type: 'string' },
          description: { type: 'string' },
          quantity: { type: 'number' },
          unit: { type: 'string' },
          unitPrice: { type: 'number' },
        },
      },
      CreateGRNRequest: {
        type: 'object',
        required: ['purchaseOrderId', 'receivedBy', 'items'],
        properties: {
          purchaseOrderId: { type: 'string' },
          receivedBy: { type: 'string' },
          receivedDate: { type: 'string', format: 'date-time' },
          remarks: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['purchaseOrderItemId', 'receivedQuantity'],
              properties: {
                purchaseOrderItemId: { type: 'string' },
                receivedQuantity: { type: 'number' },
                damagedQuantity: { type: 'number' },
                remarks: { type: 'string' },
              },
            },
          },
        },
      },
      CreateVendorRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          contactPerson: { type: 'string' },
          phone: { type: 'string' },
          email: { type: 'string' },
          address: { type: 'string' },
          city: { type: 'string' },
          state: { type: 'string' },
          country: { type: 'string' },
          zipCode: { type: 'string' },
          gstNumber: { type: 'string' },
          panNumber: { type: 'string' },
          notes: { type: 'string' },
        },
      },
      VendorApprovalStatusUpdate: {
        type: 'object',
        required: ['approvalStatus'],
        properties: {
          approvalStatus: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED'] },
        },
      },
      IssueStockRequest: {
        type: 'object',
        required: ['projectId', 'inventoryItemId', 'quantity'],
        properties: {
          projectId: { type: 'string' },
          inventoryItemId: { type: 'string' },
          quantity: { type: 'number' },
          notes: { type: 'string' },
        },
      },
      CreateUnitRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
        },
      },
      UnitStatusUpdate: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
        },
      },
      DeleteFilesRequest: {
        type: 'object',
        required: ['fileIds'],
        properties: {
          fileIds: { type: 'array', items: { type: 'string' } },
        },
      },
      Attendance: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          projectId: { type: 'string' },
          labourId: { type: 'string' },
          date: { type: 'string', format: 'date' },
          status: { type: 'string', enum: ['PRESENT', 'ABSENT'] },
          description: { type: 'string', nullable: true },
          markedById: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      MarkAttendanceRequest: {
        type: 'object',
        required: ['date', 'records'],
        properties: {
          date: { type: 'string', format: 'date', example: '2026-07-16' },
          records: {
            type: 'array',
            items: {
              type: 'object',
              required: ['labourId', 'status'],
              properties: {
                labourId: { type: 'string' },
                status: { type: 'string', enum: ['PRESENT', 'ABSENT'] },
                description: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
  paths: {
  '/': {
    get: {
      tags: ['Health'],
      summary: 'API root',
      responses: { 200: { description: 'API is running' } },
    },
  },
  '/api/health': {
    get: {
      tags: ['Health'],
      summary: 'Health check',
      responses: { 200: { description: 'Backend health status' } },
    },
  },
  '/v1/api/auth/signup': {
    post: {
      tags: ['Auth'],
      summary: 'Register a new user',
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/SignupRequest' } } },
      },
      responses: {
        201: { description: 'User created', content: { 'application/json': { schema: successResponse } } },
        400: { description: 'Bad request', content: { 'application/json': { schema: errorResponse } } },
      },
    },
  },
  '/v1/api/auth/login': {
    post: {
      tags: ['Auth'],
      summary: 'Login and get JWT token',
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
      },
      responses: {
        200: { description: 'Login successful with token', content: { 'application/json': { schema: successResponse } } },
        401: { description: 'Invalid credentials', content: { 'application/json': { schema: errorResponse } } },
      },
    },
  },
  '/v1/api/auth/create-password': {
    post: {
      tags: ['Auth'],
      summary: 'Set password for a new user',
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/CreatePasswordRequest' } } },
      },
      responses: { 200: { description: 'Password created' } },
    },
  },
  '/v1/api/auth/change-admin-password': {
    put: {
      tags: ['Auth'],
      summary: 'Change admin password',
      security: bearerAuth,
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ChangePasswordRequest' } } },
      },
      responses: { 200: { description: 'Password changed' } },
    },
  },
  '/v1/api/auth/me': {
    get: {
      tags: ['Auth'],
      summary: 'Get current authenticated user',
      security: bearerAuth,
      responses: { 200: { description: 'Current user profile' } },
    },
  },
  '/v1/api/users': {
    get: {
      tags: ['Users'],
      summary: 'List all users',
      security: bearerAuth,
      responses: { 200: { description: 'Users list' } },
    },
  },
  '/v1/api/users/{id}': {
    get: {
      tags: ['Users'],
      summary: 'Get user by ID',
      security: bearerAuth,
      parameters: [idParam],
      responses: { 200: { description: 'User details' } },
    },
    put: {
      tags: ['Users'],
      summary: 'Update user',
      security: bearerAuth,
      parameters: [idParam],
      requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
      responses: { 200: { description: 'User updated' } },
    },
  },
  '/v1/api/users/labour': {
    post: {
      tags: ['Users'],
      summary: 'Add labour',
      security: bearerAuth,
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateLabourRequest' } } },
      },
      responses: { 201: { description: 'Labour created' } },
    },
  },
  '/v1/api/users/labour/{id}': {
    put: {
      tags: ['Users'],
      summary: 'Update labour',
      security: bearerAuth,
      parameters: [idParam],
      requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateLabourRequest' } } } },
      responses: { 200: { description: 'Labour updated' } },
    },
  },
  '/v1/api/users/list/labours': {
    get: {
      tags: ['Users'],
      summary: 'List all labours',
      security: bearerAuth,
      responses: { 200: { description: 'Labours list' } },
    },
  },
  '/v1/api/users/list/managers': {
    get: {
      tags: ['Users'],
      summary: 'List all managers',
      security: bearerAuth,
      responses: { 200: { description: 'Managers list' } },
    },
  },
  '/v1/api/projects': {
    get: {
      tags: ['Projects'],
      summary: 'Get my projects',
      description: 'Returns projects managed or created by the current user',
      security: bearerAuth,
      parameters: [
        {
          name: 'projectType',
          in: 'query',
          schema: { type: 'string', enum: ['managed', 'created'] },
          description: 'Filter by managed or created projects',
        },
      ],
      responses: { 200: { description: 'Projects with progress stats' } },
    },
    post: {
      tags: ['Projects'],
      summary: 'Create project',
      description: 'Requires `create_projects` permission',
      security: bearerAuth,
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateProjectRequest' } } },
      },
      responses: { 201: { description: 'Project created' } },
    },
  },
  '/v1/api/projects/all': {
    get: {
      tags: ['Projects'],
      summary: 'Get all projects',
      description: 'Requires `view_projects` permission',
      security: bearerAuth,
      responses: { 200: { description: 'All projects' } },
    },
  },
  '/v1/api/projects/{id}': {
    put: {
      tags: ['Projects'],
      summary: 'Update project',
      description: 'Requires `update_projects` permission. managerId is optional.',
      security: bearerAuth,
      parameters: [idParam],
      requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
      responses: { 200: { description: 'Project updated' } },
    },
  },
  '/v1/api/teams': {
    post: {
      tags: ['Teams'],
      summary: 'Create team',
      security: bearerAuth,
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateTeamRequest' } } },
      },
      responses: { 201: { description: 'Team created' } },
    },
  },
  '/v1/api/teams/all': {
    get: {
      tags: ['Teams'],
      summary: 'Get all teams',
      security: bearerAuth,
      responses: { 200: { description: 'Teams list' } },
    },
  },
  '/v1/api/teams/add-member': {
    post: {
      tags: ['Teams'],
      summary: 'Add member to team',
      security: bearerAuth,
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/AddTeamMemberRequest' } } },
      },
      responses: { 200: { description: 'Member added' } },
    },
  },
  '/v1/api/teams/assign-project': {
    put: {
      tags: ['Teams'],
      summary: 'Assign project to team',
      security: bearerAuth,
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/AssignProjectRequest' } } },
      },
      responses: { 200: { description: 'Project assigned' } },
    },
  },
  '/v1/api/teams/members/{teamId}': {
    get: {
      tags: ['Teams'],
      summary: 'Get team members',
      security: bearerAuth,
      parameters: [{ name: 'teamId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Team members' } },
    },
  },
  '/v1/api/tasks': {
    post: {
      tags: ['Tasks'],
      summary: 'Create task',
      security: bearerAuth,
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateTaskRequest' } } },
      },
      responses: { 201: { description: 'Task created' } },
    },
    get: {
      tags: ['Tasks'],
      summary: 'Get all tasks',
      security: bearerAuth,
      responses: { 200: { description: 'All tasks' } },
    },
  },
  '/v1/api/tasks/my': {
    get: {
      tags: ['Tasks'],
      summary: 'Get tasks assigned to me',
      security: bearerAuth,
      responses: { 200: { description: 'My assigned tasks' } },
    },
  },
  '/v1/api/tasks/created-by-me': {
    get: {
      tags: ['Tasks'],
      summary: 'Get tasks created by me',
      security: bearerAuth,
      responses: { 200: { description: 'Tasks I created' } },
    },
  },
  '/v1/api/tasks/{id}': {
    get: {
      tags: ['Tasks'],
      summary: 'Get task by ID',
      security: bearerAuth,
      parameters: [idParam],
      responses: { 200: { description: 'Task details' } },
    },
    put: {
      tags: ['Tasks'],
      summary: 'Update task',
      security: bearerAuth,
      parameters: [idParam],
      requestBody: {
        content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateTaskRequest' } } },
      },
      responses: { 200: { description: 'Task updated' } },
    },
    delete: {
      tags: ['Tasks'],
      summary: 'Delete task',
      security: bearerAuth,
      parameters: [idParam],
      responses: { 200: { description: 'Task deleted' } },
    },
  },
  '/v1/api/tasks/{id}/updates': {
    post: {
      tags: ['Tasks'],
      summary: 'Add daily progress report for a task (optionally with images)',
      security: bearerAuth,
      parameters: [idParam],
      requestBody: {
        required: true,
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/TaskUpdateRequest' } },
          'multipart/form-data': { schema: { $ref: '#/components/schemas/TaskUpdateMultipartRequest' } },
        },
      },
      responses: {
        201: {
          description: 'Daily report added',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/TaskUpdate' } } },
        },
      },
    },
    get: {
      tags: ['Tasks'],
      summary: 'Get daily progress reports for a task',
      security: bearerAuth,
      parameters: [idParam],
      responses: {
        200: {
          description: 'Task daily reports',
          content: {
            'application/json': {
              schema: { type: 'array', items: { $ref: '#/components/schemas/TaskUpdate' } },
            },
          },
        },
      },
    },
  },
  '/v1/api/tasks/project/{projectId}/updates': {
    get: {
      tags: ['Tasks'],
      summary: 'Get all daily reports for every task in a project',
      security: bearerAuth,
      parameters: [projectIdParam],
      responses: { 200: { description: 'Project daily reports with task info' } },
    },
  },
  '/v1/api/tasks/project/{projectId}': {
    get: {
      tags: ['Tasks'],
      summary: 'Get tasks by project ID',
      security: bearerAuth,
      parameters: [projectIdParam],
      responses: { 200: { description: 'Project tasks' } },
    },
  },
  '/v1/api/roles-permissions/roles': {
    post: {
      tags: ['Roles & Permissions'],
      summary: 'Create role',
      security: bearerAuth,
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateRoleRequest' } } },
      },
      responses: { 201: { description: 'Role created' } },
    },
    get: {
      tags: ['Roles & Permissions'],
      summary: 'Get all roles',
      responses: { 200: { description: 'Roles list (public)' } },
    },
  },
  '/v1/api/roles-permissions/roles/{id}': {
    get: {
      tags: ['Roles & Permissions'],
      summary: 'Get role by ID',
      security: bearerAuth,
      parameters: [idParam],
      responses: { 200: { description: 'Role details' } },
    },
    put: {
      tags: ['Roles & Permissions'],
      summary: 'Update role',
      security: bearerAuth,
      parameters: [idParam],
      requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateRoleRequest' } } } },
      responses: { 200: { description: 'Role updated' } },
    },
    delete: {
      tags: ['Roles & Permissions'],
      summary: 'Delete role',
      security: bearerAuth,
      parameters: [idParam],
      responses: { 200: { description: 'Role deleted' } },
    },
  },
  '/v1/api/roles-permissions/permissions': {
    post: {
      tags: ['Roles & Permissions'],
      summary: 'Create permission',
      security: bearerAuth,
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/CreatePermissionRequest' } } },
      },
      responses: { 201: { description: 'Permission created' } },
    },
    get: {
      tags: ['Roles & Permissions'],
      summary: 'Get all permissions',
      security: bearerAuth,
      responses: { 200: { description: 'Permissions list' } },
    },
  },
  '/v1/api/roles-permissions/roles/assign-permissions': {
    post: {
      tags: ['Roles & Permissions'],
      summary: 'Assign permissions to role',
      security: bearerAuth,
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/AssignPermissionsRequest' } } },
      },
      responses: { 200: { description: 'Permissions assigned' } },
    },
  },
  '/v1/api/roles-permissions/roles/remove-permission': {
    delete: {
      tags: ['Roles & Permissions'],
      summary: 'Remove permission from role',
      security: bearerAuth,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['roleId', 'permissionId'],
              properties: { roleId: { type: 'string' }, permissionId: { type: 'string' } },
            },
          },
        },
      },
      responses: { 200: { description: 'Permission removed' } },
    },
  },
  '/v1/api/roles-permissions/users/assign-role': {
    post: {
      tags: ['Roles & Permissions'],
      summary: 'Assign role to user',
      security: bearerAuth,
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/AssignRoleRequest' } } },
      },
      responses: { 200: { description: 'Role assigned' } },
    },
  },
  '/v1/api/material-requests': {
    post: {
      tags: ['Material Requests'],
      summary: 'Create material request',
      description: 'Requires `create_material_requests` permission',
      security: bearerAuth,
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateMaterialRequest' } } },
      },
      responses: { 201: { description: 'Material request created' } },
    },
    get: {
      tags: ['Material Requests'],
      summary: 'Get all material requests',
      description: 'Requires `view_material_requests` permission',
      security: bearerAuth,
      responses: { 200: { description: 'Material requests list' } },
    },
  },
  '/v1/api/material-requests/{id}': {
    get: {
      tags: ['Material Requests'],
      summary: 'Get material request by ID',
      security: bearerAuth,
      parameters: [idParam],
      responses: { 200: { description: 'Material request details' } },
    },
    put: {
      tags: ['Material Requests'],
      summary: 'Update material request',
      security: bearerAuth,
      parameters: [idParam],
      requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
      responses: { 200: { description: 'Material request updated' } },
    },
    delete: {
      tags: ['Material Requests'],
      summary: 'Delete material request',
      security: bearerAuth,
      parameters: [idParam],
      responses: { 200: { description: 'Material request deleted' } },
    },
  },
  '/v1/api/material-requests/project/{projectId}': {
    get: {
      tags: ['Material Requests'],
      summary: 'Get material requests by project',
      security: bearerAuth,
      parameters: [projectIdParam],
      responses: { 200: { description: 'Project material requests' } },
    },
  },
  '/v1/api/material-requests/{id}/status': {
    patch: {
      tags: ['Material Requests'],
      summary: 'Update material request status',
      security: bearerAuth,
      parameters: [idParam],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/StatusUpdate' } } },
      },
      responses: { 200: { description: 'Status updated' } },
    },
  },
  '/v1/api/material-requests/{id}/items': {
    post: {
      tags: ['Material Requests'],
      summary: 'Add item to material request',
      security: bearerAuth,
      parameters: [idParam],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/MaterialRequestItemInput' } } },
      },
      responses: { 201: { description: 'Item added' } },
    },
  },
  '/v1/api/material-requests/items/{itemId}': {
    put: {
      tags: ['Material Requests'],
      summary: 'Update material request item',
      security: bearerAuth,
      parameters: [{ name: 'itemId', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: {
        content: { 'application/json': { schema: { $ref: '#/components/schemas/MaterialRequestItemInput' } } },
      },
      responses: { 200: { description: 'Item updated' } },
    },
    delete: {
      tags: ['Material Requests'],
      summary: 'Delete material request item',
      security: bearerAuth,
      parameters: [{ name: 'itemId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Item deleted' } },
    },
  },
  '/v1/api/ai': {
    post: {
      tags: ['AI'],
      summary: 'Upload BOQ file for AI processing',
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['file', 'projectId'],
              properties: {
                file: { type: 'string', format: 'binary' },
                projectId: { type: 'string' },
              },
            },
          },
        },
      },
      responses: { 200: { description: 'BOQ processed' } },
    },
  },
  '/v1/api/boq/upload': {
    post: {
      tags: ['BOQ'],
      summary: 'Upload BOQ file',
      security: bearerAuth,
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['file', 'projectId'],
              properties: {
                file: { type: 'string', format: 'binary' },
                projectId: { type: 'string' },
              },
            },
          },
        },
      },
      responses: { 201: { description: 'BOQ uploaded' } },
    },
  },
  '/v1/api/boq/download/{id}': {
    get: {
      tags: ['BOQ'],
      summary: 'Download BOQ file (signed URL)',
      security: bearerAuth,
      parameters: [idParam],
      responses: { 200: { description: 'Signed download URL' } },
    },
  },
  '/v1/api/boq/project/{projectId}': {
    get: {
      tags: ['BOQ'],
      summary: 'Get all BOQs for a project',
      security: bearerAuth,
      parameters: [projectIdParam],
      responses: { 200: { description: 'Project BOQs' } },
    },
  },
  '/v1/api/boq/project/{projectId}/file': {
    get: {
      tags: ['BOQ'],
      summary: 'Get latest BOQ file for a project',
      security: bearerAuth,
      parameters: [projectIdParam],
      responses: { 200: { description: 'Latest BOQ with download URL' } },
    },
  },
  '/v1/api/boq/{id}': {
    get: {
      tags: ['BOQ'],
      summary: 'Get BOQ by ID',
      security: bearerAuth,
      parameters: [idParam],
      responses: { 200: { description: 'BOQ details' } },
    },
  },
  '/v1/api/files/upload': {
    post: {
      tags: ['Files'],
      summary: 'Upload project files',
      security: bearerAuth,
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['files', 'projectId'],
              properties: {
                files: { type: 'array', items: { type: 'string', format: 'binary' } },
                projectId: { type: 'string' },
              },
            },
          },
        },
      },
      responses: { 200: { description: 'Files uploaded' } },
    },
  },
  '/v1/api/files/project/{projectId}': {
    get: {
      tags: ['Files'],
      summary: 'Get all files for a project',
      security: bearerAuth,
      parameters: [projectIdParam],
      responses: { 200: { description: 'Project files' } },
    },
  },
  '/v1/api/files/download/{id}': {
    get: {
      tags: ['Files'],
      summary: 'Get file download URL',
      security: bearerAuth,
      parameters: [idParam],
      responses: { 200: { description: 'Signed download URL' } },
    },
  },
  '/v1/api/files/{id}': {
    get: {
      tags: ['Files'],
      summary: 'Get file by ID',
      security: bearerAuth,
      parameters: [idParam],
      responses: { 200: { description: 'File details with download URL' } },
    },
    delete: {
      tags: ['Files'],
      summary: 'Delete file',
      security: bearerAuth,
      parameters: [idParam],
      responses: { 200: { description: 'File deleted' } },
    },
  },
  '/v1/api/files': {
    delete: {
      tags: ['Files'],
      summary: 'Delete multiple files',
      security: bearerAuth,
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/DeleteFilesRequest' } } },
      },
      responses: { 200: { description: 'Files deleted' } },
    },
  },
  '/v1/api/purchase-orders': {
    post: {
      tags: ['Purchase Orders'],
      summary: 'Create purchase order from an approved material request',
      description:
        'Admin only. POs have no draft stage — they are created directly as APPROVED. Flips the material request status to ORDERED.',
      security: bearerAuth,
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/CreatePurchaseOrderRequest' } } },
      },
      responses: { 201: { description: 'Purchase order created' } },
    },
    get: {
      tags: ['Purchase Orders'],
      summary: 'Get all purchase orders',
      description: 'Optional filters: status, vendorId, vendorName',
      security: bearerAuth,
      parameters: [
        { name: 'status', in: 'query', schema: { type: 'string' } },
        { name: 'vendorId', in: 'query', schema: { type: 'string' } },
        { name: 'vendorName', in: 'query', schema: { type: 'string' } },
      ],
      responses: { 200: { description: 'Purchase orders list' } },
    },
  },
  '/v1/api/purchase-orders/material-request/{materialRequestId}': {
    get: {
      tags: ['Purchase Orders'],
      summary: 'Get purchase orders by material request',
      security: bearerAuth,
      parameters: [{ name: 'materialRequestId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Purchase orders for material request' } },
    },
  },
  '/v1/api/purchase-orders/{id}': {
    get: {
      tags: ['Purchase Orders'],
      summary: 'Get purchase order by ID',
      security: bearerAuth,
      parameters: [idParam],
      responses: { 200: { description: 'Purchase order details' } },
    },
    put: {
      tags: ['Purchase Orders'],
      summary: 'Update purchase order',
      description: 'Admin only. Only allowed while the PO status is APPROVED.',
      security: bearerAuth,
      parameters: [idParam],
      requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
      responses: { 200: { description: 'Purchase order updated' } },
    },
    delete: {
      tags: ['Purchase Orders'],
      summary: 'Delete purchase order',
      description: 'Admin only. Only purchase orders that have not been sent yet (status APPROVED) can be deleted.',
      security: bearerAuth,
      parameters: [idParam],
      responses: { 200: { description: 'Purchase order deleted' } },
    },
  },
  '/v1/api/purchase-orders/{id}/status': {
    patch: {
      tags: ['Purchase Orders'],
      summary: 'Update purchase order status',
      description:
        'Admin only. Valid values: APPROVED, SENT, PARTIALLY_RECEIVED, RECEIVED, CANCELLED. Setting RECEIVED cascades the parent material request status to DELIVERED.',
      security: bearerAuth,
      parameters: [idParam],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/StatusUpdate' } } },
      },
      responses: { 200: { description: 'Status updated' } },
    },
  },
  '/v1/api/purchase-orders/{id}/items': {
    post: {
      tags: ['Purchase Orders'],
      summary: 'Add item to purchase order',
      security: bearerAuth,
      parameters: [idParam],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/POItemInput' } } },
      },
      responses: { 201: { description: 'Item added' } },
    },
  },
  '/v1/api/purchase-orders/items/{itemId}': {
    put: {
      tags: ['Purchase Orders'],
      summary: 'Update purchase order item',
      security: bearerAuth,
      parameters: [{ name: 'itemId', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: {
        content: { 'application/json': { schema: { $ref: '#/components/schemas/POItemInput' } } },
      },
      responses: { 200: { description: 'Item updated' } },
    },
    delete: {
      tags: ['Purchase Orders'],
      summary: 'Delete purchase order item',
      security: bearerAuth,
      parameters: [{ name: 'itemId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Item deleted' } },
    },
  },
  '/v1/api/grn': {
    post: {
      tags: ['GRN'],
      summary: 'Create GRN from purchase order',
      description:
        'Admin or accountant. PO must be SENT, APPROVED, or PARTIALLY_RECEIVED. Immediately records stock-IN movements for each item\'s receivedQuantity (damagedQuantity never contributes to stock).',
      security: bearerAuth,
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateGRNRequest' } } },
      },
      responses: { 201: { description: 'GRN created' } },
    },
    get: {
      tags: ['GRN'],
      summary: 'Get all GRNs',
      description: 'Optional filters: status, purchaseOrderId, projectId',
      security: bearerAuth,
      parameters: [
        { name: 'status', in: 'query', schema: { type: 'string' } },
        { name: 'purchaseOrderId', in: 'query', schema: { type: 'string' } },
        { name: 'projectId', in: 'query', schema: { type: 'string' } },
      ],
      responses: { 200: { description: 'GRNs list' } },
    },
  },
  '/v1/api/grn/{id}': {
    get: {
      tags: ['GRN'],
      summary: 'Get GRN by ID',
      security: bearerAuth,
      parameters: [idParam],
      responses: { 200: { description: 'GRN details' } },
    },
    put: {
      tags: ['GRN'],
      summary: 'Update GRN',
      description:
        'Admin or accountant. Only while GRN status is PENDING. Replacing items reverses and re-records stock movements and recomputes the parent PO status.',
      security: bearerAuth,
      parameters: [idParam],
      requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
      responses: { 200: { description: 'GRN updated' } },
    },
    delete: {
      tags: ['GRN'],
      summary: 'Delete GRN',
      description:
        'Admin or accountant. Only while GRN status is PENDING or REJECTED. Reverses stock movements and recomputes the parent PO status.',
      security: bearerAuth,
      parameters: [idParam],
      responses: { 200: { description: 'GRN deleted' } },
    },
  },
  '/v1/api/grn/purchase-order/{purchaseOrderId}': {
    get: {
      tags: ['GRN'],
      summary: 'Get GRNs by purchase order',
      security: bearerAuth,
      parameters: [{ name: 'purchaseOrderId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'GRNs for purchase order' } },
    },
  },
  '/v1/api/grn/project/{projectId}': {
    get: {
      tags: ['GRN'],
      summary: 'Get GRNs by project',
      security: bearerAuth,
      parameters: [projectIdParam],
      responses: { 200: { description: 'GRNs for project' } },
    },
  },
  '/v1/api/grn/summary/purchase-order/{purchaseOrderId}': {
    get: {
      tags: ['GRN'],
      summary: 'Get GRN summary for a purchase order',
      security: bearerAuth,
      parameters: [{ name: 'purchaseOrderId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'GRN summary' } },
    },
  },
  '/v1/api/grn/{id}/status': {
    patch: {
      tags: ['GRN'],
      summary: 'Update GRN status',
      description:
        'Admin or accountant. Valid values: PENDING, COMPLETED, PARTIALLY_RECEIVED, REJECTED. REJECTED reverses this GRN\'s stock movements and recomputes the parent PO status from the remaining valid GRNs.',
      security: bearerAuth,
      parameters: [idParam],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/StatusUpdate' } } },
      },
      responses: { 200: { description: 'Status updated' } },
    },
  },
  '/v1/api/vendors/active': {
    get: {
      tags: ['Vendors'],
      summary: 'Get active vendors (for dropdowns)',
      security: bearerAuth,
      responses: { 200: { description: 'Active vendors' } },
    },
  },
  '/v1/api/vendors': {
    post: {
      tags: ['Vendors'],
      summary: 'Create vendor',
      security: bearerAuth,
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateVendorRequest' } } },
      },
      responses: { 201: { description: 'Vendor created' } },
    },
    get: {
      tags: ['Vendors'],
      summary: 'Get all vendors',
      description: 'Optional filters: status, search',
      security: bearerAuth,
      parameters: [
        { name: 'status', in: 'query', schema: { type: 'string' } },
        { name: 'search', in: 'query', schema: { type: 'string' } },
      ],
      responses: { 200: { description: 'Vendors list' } },
    },
  },
  '/v1/api/vendors/{id}': {
    get: {
      tags: ['Vendors'],
      summary: 'Get vendor by ID',
      security: bearerAuth,
      parameters: [idParam],
      responses: { 200: { description: 'Vendor details' } },
    },
    put: {
      tags: ['Vendors'],
      summary: 'Update vendor',
      security: bearerAuth,
      parameters: [idParam],
      requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateVendorRequest' } } } },
      responses: { 200: { description: 'Vendor updated' } },
    },
    delete: {
      tags: ['Vendors'],
      summary: 'Delete vendor',
      security: bearerAuth,
      parameters: [idParam],
      responses: { 200: { description: 'Vendor deleted' } },
    },
  },
  '/v1/api/vendors/{id}/stats': {
    get: {
      tags: ['Vendors'],
      summary: 'Get vendor statistics',
      security: bearerAuth,
      parameters: [idParam],
      responses: { 200: { description: 'Vendor stats' } },
    },
  },
  '/v1/api/vendors/{id}/status': {
    patch: {
      tags: ['Vendors'],
      summary: 'Update vendor status',
      security: bearerAuth,
      parameters: [idParam],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/StatusUpdate' } } },
      },
      responses: { 200: { description: 'Status updated' } },
    },
  },
  '/v1/api/vendors/{id}/approval-status': {
    patch: {
      tags: ['Vendors'],
      summary: 'Update vendor approval status',
      description:
        'Admin only. A vendor must be ACTIVE and APPROVED before it can be attached to a purchase order.',
      security: bearerAuth,
      parameters: [idParam],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/VendorApprovalStatusUpdate' } } },
      },
      responses: { 200: { description: 'Approval status updated' } },
    },
  },
  '/v1/api/inventory/items': {
    get: {
      tags: ['Inventory'],
      summary: 'List all inventory items',
      description: 'Requires view_inventory (admin, accountant, or supervisor).',
      security: bearerAuth,
      responses: { 200: { description: 'Inventory items list' } },
    },
  },
  '/v1/api/inventory/stock/project/{projectId}': {
    get: {
      tags: ['Inventory'],
      summary: 'Current stock per item for a project',
      description: 'Derived from the append-only stock movement ledger: sum(IN) - sum(OUT).',
      security: bearerAuth,
      parameters: [projectIdParam],
      responses: { 200: { description: 'Project stock levels' } },
    },
  },
  '/v1/api/inventory/stock/material/{inventoryItemId}': {
    get: {
      tags: ['Inventory'],
      summary: 'Current stock for one item, broken down by project',
      security: bearerAuth,
      parameters: [{ name: 'inventoryItemId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Material stock by project' } },
    },
  },
  '/v1/api/inventory/movements': {
    get: {
      tags: ['Inventory'],
      summary: 'Stock movement ledger',
      description: 'Optional filters: projectId, inventoryItemId, type (IN|OUT)',
      security: bearerAuth,
      parameters: [
        { name: 'projectId', in: 'query', schema: { type: 'string' } },
        { name: 'inventoryItemId', in: 'query', schema: { type: 'string' } },
        { name: 'type', in: 'query', schema: { type: 'string', enum: ['IN', 'OUT'] } },
      ],
      responses: { 200: { description: 'Stock movements' } },
    },
  },
  '/v1/api/inventory/issue': {
    post: {
      tags: ['Inventory'],
      summary: 'Issue (stock out) materials against a project',
      description:
        'Requires issue_inventory (admin or supervisor). Rejects if quantity exceeds current project stock. Never transfers across projects.',
      security: bearerAuth,
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/IssueStockRequest' } } },
      },
      responses: { 201: { description: 'Stock issued' } },
    },
  },
  '/v1/api/units': {
    post: {
      tags: ['Units'],
      summary: 'Create unit',
      description: 'Admin only. Name must be unique, case-insensitive.',
      security: bearerAuth,
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateUnitRequest' } } },
      },
      responses: { 201: { description: 'Unit created' } },
    },
    get: {
      tags: ['Units'],
      summary: 'List units',
      description: 'Any authenticated user. ?status=ACTIVE|INACTIVE|ALL, defaults to ACTIVE.',
      security: bearerAuth,
      parameters: [{ name: 'status', in: 'query', schema: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'ALL'] } }],
      responses: { 200: { description: 'Units list' } },
    },
  },
  '/v1/api/units/{id}': {
    put: {
      tags: ['Units'],
      summary: 'Rename unit',
      description: 'Admin only.',
      security: bearerAuth,
      parameters: [idParam],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateUnitRequest' } } },
      },
      responses: { 200: { description: 'Unit updated' } },
    },
    delete: {
      tags: ['Units'],
      summary: 'Delete unit',
      description: 'Admin only. Hard delete.',
      security: bearerAuth,
      parameters: [idParam],
      responses: { 200: { description: 'Unit deleted' } },
    },
  },
  '/v1/api/units/{id}/status': {
    patch: {
      tags: ['Units'],
      summary: 'Set unit status',
      description: 'Admin only.',
      security: bearerAuth,
      parameters: [idParam],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/UnitStatusUpdate' } } },
      },
      responses: { 200: { description: 'Status updated' } },
    },
  },
  '/v1/api/dashboard/stats': {
    get: {
      tags: ['Dashboard'],
      summary: 'Get overall dashboard stats',
      description: 'Includes procurement pipeline metrics',
      security: bearerAuth,
      responses: { 200: { description: 'Dashboard statistics' } },
    },
  },
  '/v1/api/dashboard/project/{projectId}': {
    get: {
      tags: ['Dashboard'],
      summary: 'Get project-specific dashboard stats',
      security: bearerAuth,
      parameters: [projectIdParam],
      responses: { 200: { description: 'Project dashboard stats' } },
    },
  },
  '/v1/api/dashboard/recent-activity': {
    get: {
      tags: ['Dashboard'],
      summary: 'Get recent activity feed',
      security: bearerAuth,
      responses: { 200: { description: 'Recent activity' } },
    },
  },
  '/v1/api/attendance/project/{projectId}/workers': {
    get: {
      tags: ['Attendance'],
      summary: 'Get workers for a project (team members + task-assigned labours)',
      description:
        'Requires the mark_attendance permission. Pass ?date= to include each worker\'s already-marked attendance for that date.',
      security: bearerAuth,
      parameters: [
        projectIdParam,
        { name: 'date', in: 'query', required: false, schema: { type: 'string', format: 'date' } },
      ],
      responses: { 200: { description: 'Project workers, optionally with attendance for the given date' } },
    },
  },
  '/v1/api/attendance/project/{projectId}': {
    post: {
      tags: ['Attendance'],
      summary: 'Mark attendance for workers of a project on a date',
      description: 'Requires the mark_attendance permission. Upserts one record per labour per date.',
      security: bearerAuth,
      parameters: [projectIdParam],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/MarkAttendanceRequest' } } },
      },
      responses: {
        200: {
          description: 'Attendance marked',
          content: {
            'application/json': {
              schema: { type: 'array', items: { $ref: '#/components/schemas/Attendance' } },
            },
          },
        },
      },
    },
    get: {
      tags: ['Attendance'],
      summary: 'Get attendance by date or date range',
      description:
        'Requires the view_attendance permission. Provide either ?date= for a single day, or ?startDate= and ?endDate= for a range. Records are grouped by date with present/absent counts.',
      security: bearerAuth,
      parameters: [
        projectIdParam,
        { name: 'date', in: 'query', required: false, schema: { type: 'string', format: 'date' } },
        { name: 'startDate', in: 'query', required: false, schema: { type: 'string', format: 'date' } },
        { name: 'endDate', in: 'query', required: false, schema: { type: 'string', format: 'date' } },
      ],
      responses: { 200: { description: 'Attendance grouped by date with summary counts' } },
    },
  },
  },
};
