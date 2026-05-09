import { exec as execCb } from "child_process";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { promisify } from "util";

import { prisma } from "../lib/prisma";

const exec = promisify(execCb);

export class BackupService {
  private readonly backupDir: string;

  constructor() {
    this.backupDir = process.env.BACKUP_DIR ?? path.join(__dirname, "../../backups");
  }

  private getPgDumpExecutable(): string {
    const explicitPath = process.env.PG_DUMP_PATH?.trim();
    if (explicitPath) {
      return explicitPath;
    }
    const postgresBin = process.env.POSTGRES_BIN_PATH?.trim();
    if (postgresBin) {
      return path.join(postgresBin, process.platform === "win32" ? "pg_dump.exe" : "pg_dump");
    }
    return "pg_dump";
  }

  private async isPgDumpAvailable(): Promise<boolean> {
    try {
      const pgDump = this.getPgDumpExecutable();
      await exec(`"${pgDump}" --version`);
      return true;
    } catch {
      return false;
    }
  }

  async createBackup(tenantId: string, type: "manual" | "scheduled" = "manual") {
    // SECURITY: Never expose DATABASE_URL in command line
    // Parse connection string and use environment variables instead
    const dbUrl = new URL(process.env.DATABASE_URL!);
    const env = {
      ...process.env,
      PGHOST: dbUrl.hostname,
      PGPORT: dbUrl.port,
      PGDATABASE: dbUrl.pathname.slice(1), // Remove leading slash
      PGUSER: dbUrl.username,
      PGPASSWORD: dbUrl.password,
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `backup-${tenantId}-${type}-${timestamp}.sql.gz`;
    const filepath = path.join(this.backupDir, filename);

    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }

    const pgDump = this.getPgDumpExecutable();
    // Use environment variables instead of command line arguments
    const cmd = `"${pgDump}" --no-password --compress=9 --format=custom --file="${filepath}"`;
    let status = "COMPLETED";
    let checksum: string | null = null;
    let fileSize = 0;

    try {
      await exec(cmd, { env });
      const fileContent = fs.readFileSync(filepath);
      checksum = crypto.createHash("sha256").update(fileContent).digest("hex");
      fileSize = fs.statSync(filepath).size;
    } catch (error) {
      status = "FAILED";
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
      throw error;
    } finally {
      await prisma.backup.create({
        data: {
          tenantId,
          type,
          filePath: filepath,
          fileSize,
          checksum,
          status,
          completedAt: new Date(),
        },
      });
    }

    return { filePath: filepath, checksum, fileSize, status };
  }

  async verifyBackup(filepath: string) {
    if (!fs.existsSync(filepath)) {
      throw new Error("Backup file not found");
    }

    const fileContent = fs.readFileSync(filepath);
    return crypto.createHash("sha256").update(fileContent).digest("hex");
  }

  async cleanupOldBackups(tenantId: string): Promise<void> {
    const latestBackups = await prisma.backup.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      skip: 30,
    });

    for (const backup of latestBackups) {
      if (fs.existsSync(backup.filePath)) {
        try {
          fs.unlinkSync(backup.filePath);
        } catch {
          // ignore cleanup failures for stale files
        }
      }
      await prisma.backup.delete({ where: { id: backup.id } });
    }
  }

  scheduleBackups(): void {
    const intervalMs = 24 * 60 * 60 * 1000;

    const getTenantId = async (): Promise<string | null> => {
      if (process.env.DEFAULT_TENANT_ID) {
        return process.env.DEFAULT_TENANT_ID;
      }
      const tenant = await prisma.tenant.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
      });
      return tenant?.id ?? null;
    };

    const runBackup = async () => {
      try {
        const tenantId = await getTenantId();
        if (!tenantId) {
          console.warn("BackupService: no tenant available for scheduled backup");
          return;
        }
        await this.createBackup(tenantId, "scheduled");
        await this.cleanupOldBackups(tenantId);
      } catch (error) {
        console.error("Scheduled backup failed", error);
      }
    };

    const startSchedule = async () => {
      const available = await this.isPgDumpAvailable();
      if (!available) {
        console.warn(
          "BackupService: pg_dump not available. Scheduled backups are disabled. Set PG_DUMP_PATH or add pg_dump to PATH.",
        );
        return;
      }

      setTimeout(() => {
        void runBackup();
        setInterval(() => {
          void runBackup();
        }, intervalMs);
      }, 30 * 1000);
    };

    void startSchedule();
  }
}
