import { Prisma } from "@prisma/client";

export class DatabaseUnavailableError extends Error {
  public readonly code = "DB_UNAVAILABLE";

  constructor(message = "Database unavailable") {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

export function isDatabaseConnectionError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return ["P1001", "P1008", "P1010", "P1011", "P1012", "P1013", "P1014", "P1015"].includes(error.code);
  }

  if (
    error instanceof Prisma.PrismaClientRustPanicError ||
    error instanceof Prisma.PrismaClientInitializationError
  ) {
    return true;
  }

  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return /connection.*refused|could not connect|timed out|p1001|p1010|p1011|p1012|p1013|p1014|p1015/.test(message);
}

export function isDatabaseUnavailableError(error: unknown): boolean {
  return error instanceof DatabaseUnavailableError || isDatabaseConnectionError(error);
}
