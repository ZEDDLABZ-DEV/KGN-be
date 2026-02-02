import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { created, error, prisma, success } from '@/Utils';
import logger from '@/config/logger';
import { LoginMethod } from '@prisma/client';
import { AuthRequest } from '@/middleware/Auth';

const JWT_SECRET: any = process.env.JWT_SECRET;

export const authLogin = async (req: Request, res: Response) => {
  try {
    const { login, password } = req.body;
    const auth:any = await prisma.auth.findUnique({
      where: { login },
      include: {
        user: {
          select: {
            id: true,
            role: true,
          },
        },
      },
    });

 
    if (!auth) return error(res, 'Invalid login or password', 401);

    const isValid = await bcrypt.compare(password, auth.password);
    if (!isValid) return error(res, 'Invalid login or password', 401);

    const token = jwt.sign(
      { id: auth.user.id, role: auth.user.role.name, roleId: auth.user.role.id },
      JWT_SECRET
    );

    return success(res, 'Login successful', { token });
  } catch (err) {
    logger.info(err);
    return error(res, 'Login failed');
  }
};

// 🧱 SIGNUP CONTROLLER
export const signup = async (req: Request, res: Response) => {
  try {
    const {
      email,
      password,
      name,
      phone,
      gender,
      roleId,
      dateOfBirth,
      loginWith,
    } = req.body;

    // Check if user already exists
    const existingUser = await prisma.auth.findFirst({
      where: { OR: [{ login: email }, { login: phone }] },
    });

    if (existingUser) {
      return res
        .status(400)
        .json({ message: 'User already exists with this Email / Phone' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create User record
    const newUser:any = await prisma.user.create({
      data: {
        email,
        name,
        phone,
        gender,
        roleId,
        dateOfBirth,
      },
    });

    // Create Auth record
    await prisma.auth.create({
      data: {
        userId: newUser.id,
        login: newUser.email,
        password: hashedPassword,
        loginWith: loginWith === LoginMethod.EMAIL ? LoginMethod.EMAIL : LoginMethod.PHONE,
      },
    });

    logger.info(`🧾 New user registered: ${newUser.email}`);

    return created(res, 'Signup successful', {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
      name: newUser.name,
    });
  } catch (err: any) {
    logger.error('Signup Error: ' + err.message);
    return error(res, 'Internal server error');
  }
};

export const createPassword = async(req:AuthRequest, res:Response) => {
  try { 
    
    const {password, userId} = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);
    
    await prisma.auth.update({
      data: {
        password: hashedPassword
      },
      where: {
        userId
      }
    })

    return created(res, "Password Created")

  } catch (err:any) {
    console.log(err);
    return error(res, "Internal Server Error", 400)
  }
}

export const me = async (req: AuthRequest, res: Response) => {
  try {
    
    const user = await prisma.user.findUnique({
      where: {
        id: req.userId,
      },
      include: {
        Auth: {
          select: {
            loginWith: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
            permissions: {
              select: {
                permission: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        }
      },
    });

    const userPermissions = user?.role?.permissions.map((permission) => ({id: permission.permission.id, name: permission.permission.name}));

    delete (user as any)?.role?.permissions;

    return success(res, 'User details fetched', {
      ...user,
      permissions: userPermissions,
    });
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to get user');
  }
};
