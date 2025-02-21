import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      userId: string|null;
      role: string|null;
    }
  }
}

const verifyToken = (req: Request, res: Response, next: NextFunction): any => {
  const token = req.cookies["auth_token"];
  if (!token) {
    return res.status(401).json({ message: "unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY as string);
    req.userId = (decoded as JwtPayload).userId;
    req.role = (decoded as JwtPayload).role;
    next();
  } catch (error) {

    return res.status(401).json({ message: "unauthorized" });
  }
};

// Proband Funcionamiento Token?
/*
const verifyToken = (req: Request, res: Response, next: NextFunction): any => {
  const token = req.cookies["auth_token"];
  if (!token) {
    return res.status(401).json({ message: "unauthorized" });
  }
  const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY as string);
  req.userId = (decoded as JwtPayload).userId;
  req.role = (decoded as JwtPayload).role;
  next();
};
*/

export default verifyToken;