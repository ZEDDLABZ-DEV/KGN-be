import 'module-alias/register';
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { router } from "@/routes";
import { authMiddleware } from "./middleware/Auth";
dotenv.config();

const app = express();

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'https://main.dldx21wm9ykkk.amplifyapp.com', 'https://constructiongroupofcompanies.com'],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  credentials: true, // allow cookies/auth headers if needed
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes

app.use(
  (authMiddleware as any).unless({
    path: [
      { url: '/v1/api/health', methods: ['GET'] },
      { url: '/v1/api/auth/login', methods: ['POST'] },
      { url: '/v1/api/auth/signup', methods: ['POST'] },
      { url: '/v1/api/auth/verify-otp', methods: ['POST'] },
      { url: '/v1/api/auth/create-password', methods: ['POST'] },
      { url: '/v1/api/auth/refresh', methods: ['POST'] },
      { url: '/v1/api/auth/logout', methods: ['POST'] },
      { url: '/v1/api/ai', methods: ['POST'] },
      { url: '/v1/api/roles-permissions/roles', methods: ['GET'] },
    ]
  })
)

app.use("/v1/api", router);


app.get("/api/health", (_, res) => {
  try {
    res.status(200).json("🚀 Backend is healthy");
  } catch (error) {
    res.status(200).json("Backend is Down");
  }
});

app.get("/", (_, res) => {
  res.status(200).json("🚀 API is running");
});

export default app;
