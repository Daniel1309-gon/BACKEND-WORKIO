import { Request, Response, NextFunction } from "express";


const verifyAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.userId || req.role !== "admin") {
    res.status(403).json({ message: "Access denied: Admins only" });
    return;
  }
  next();
};

export default verifyAdmin;
