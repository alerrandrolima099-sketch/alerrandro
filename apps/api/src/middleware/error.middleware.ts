import { NextFunction, Request, Response } from "express";

export class AppError extends Error {
  statusCode: number;
  code?: string;
  constructor(statusCode: number, message: string, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ statusCode: err.statusCode, message: err.message, code: err.code });
  }

  // eslint-disable-next-line no-console
  console.error("[unhandled error]", err);
  return res.status(500).json({ statusCode: 500, message: "Internal server error" });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ statusCode: 404, message: "Route not found" });
}
