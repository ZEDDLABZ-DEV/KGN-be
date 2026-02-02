import logger from '@/config/logger';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';

const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'info' },
    { emit: 'event', level: 'warn' },
    { emit: 'event', level: 'error' },
  ],
});

// Listen to Prisma events
prisma.$on('query', (e) => {
  logger.info(
    `\n🔍 Query: ${e.query}\nParams: ${e.params}\nDuration: ${e.duration}ms`
  );
});

prisma.$on('info', (e) => {
  logger.info(`ℹ️ Prisma Info: ${e.message}`);
});

prisma.$on('warn', (e) => {
  logger.warn(`⚠️ Prisma Warning: ${e.message}`);
});

prisma.$on('error', (e) => {
  logger.error(`❌ Prisma Error: ${e.message}`);
});

export { prisma };

export const success = (res: any, message: string, data?: any): Promise<any> =>
  res.status(200).json({ success: true, message, data });

export const created = (res: any, message: string, data?: any) =>
  res.status(201).json({ success: true, message, data });

export const error = (res: any, message: string, statusCode = 400) =>
  res.status(statusCode).json({ success: false, message });

export const generateProjectId = async (
  project: string
) => {
  let projId: string = '';
  let unique = false;

  const genId = () => {
    const sanitize = (name: string) =>
      name
        .replace(/[^A-Za-z]/g, '')
        .substring(0, 4)
        .toUpperCase()
        .padEnd(4, 'X');

    const projectPrefix = sanitize(project);
    const random = Math.floor(1000 + Math.random() * 9000);

    return `PROJ-${projectPrefix}-${random}`;
  };
  
  while (!unique) {
      projId = genId();
    const existing = await prisma.projects.findUnique({ where: { projectId: projId } });
    if (!existing) unique = true;
  }
  return projId;
};
// Use memory storage for direct S3 uploads
const storage = multer.memoryStorage();

const fileFilter = (req: any, file: any, cb: any) => {
  // Allow all file types, you can restrict this if needed
  cb(null, true);
};

export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
  },
});
