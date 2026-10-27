import app from "./app";
import logger from "@/config/logger";
import { prisma } from "@/Utils";

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  try {
    await prisma.$connect();
    logger.info(`DB connected`);
  } catch (error:any) {
    logger.error("DB connection failed", error);
  }
  logger.info(`Server running on ${PORT}`);
});
