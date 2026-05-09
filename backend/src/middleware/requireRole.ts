import type { UserRole } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";

export function requireRole(...allowed: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.userRole;
    if (!role || !allowed.includes(role)) {
      res.status(403).json({ error: "Forbidden", code: "FORBIDDEN" });
      return;
    }
    next();
  };
}
