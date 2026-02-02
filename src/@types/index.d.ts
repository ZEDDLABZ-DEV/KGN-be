import "express";

declare module "express" {
  export interface Request {
      id: string;
      email: string;
      iat?: number;
      exp?: number;
  }
}