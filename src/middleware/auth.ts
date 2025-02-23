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

/* Prueba de problema token

const verifyToken = (req: Request, res: Response, next: NextFunction): any => {
  const token = req.cookies["auth_token"];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY as string);
    req.role = (decoded as JwtPayload).role;
    next();
  } catch (error) {

    return res.status(401);
  }
};


*/


/* Correcion Token Segunda vez

const verifyToken = (req: Request, res: Response, next: NextFunction): any => {
  const token = req.cookies["auth_token"];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY as string);
    req.userId = (decoded as JwtPayload).userId;
    req.role = (decoded as JwtPayload).role;
  }
};


*/

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

export default verifyToken;