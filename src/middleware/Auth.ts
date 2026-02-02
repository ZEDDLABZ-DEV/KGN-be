import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { unless } from 'express-unless';

const JWT_SECRET = process.env.JWT_SECRET as string;

export interface AuthRequest extends Request {
  userId?: string;
  role?: string
  immigrationId?: string
}

const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const header: any = req.headers.authorization;

  if (!header) {    
    return res.status(401).json({ message: 'Unauthorized User' });
  }

  const token = header.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized User' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string, role:string, immigrationId:string };    
    req.userId = decoded.id;
    req.role = decoded.role
    req.immigrationId = decoded.immigrationId
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

authMiddleware.unless = unless;

export { authMiddleware };
