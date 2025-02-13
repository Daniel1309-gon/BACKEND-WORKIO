import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

const verifyToken = (req: Request, res: Response, next: NextFunction): any => {
  //const token = req.cookies["auth_token"];
  const token = req.cookies?.auth_token || // Cookies
                req.headers?.authorization?.replace('Bearer ', '') || // Authorization header
                req.headers?.['x-access-token'] || // Custom header
                req.query?.token; // Query parameter
  console.log("token",token);
  if (!token) {
    return res.status(401).json({ message: "unauthorized" });
  }

  try {
    console.log(process.env.JWT_SECRET_KEY);
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY as string);
    req.userId = (decoded as JwtPayload).userId;
    next();
  } catch (error) {
    return res.status(401).json({ message: "unauthorized" });
  }
};

export default verifyToken;