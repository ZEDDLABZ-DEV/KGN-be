import app from "./app";
import logger from "@/config/logger";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const PORT = process.env.PORT;

app.listen(PORT, async () => {
  try {
    await prisma.$connect();
    logger.info(`DB connected`);
  } catch (error:any) {
    logger.error("DB connection failed", error);
  }
  logger.info(`Server running on ${PORT}`);
});
