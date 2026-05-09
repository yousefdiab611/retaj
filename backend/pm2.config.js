/* eslint-env node */
/**
 * PM2 ecosystem file for the Retaj Store backend.
 * Run: pm2 start backend/pm2.config.js --env production
 */
module.exports = {
  apps: [
    {
      name: "retaj-api",
      script: "dist/index.js",
      cwd: __dirname,
      instances: process.env.PM2_INSTANCES || "max",
      exec_mode: "cluster",
      max_memory_restart: process.env.PM2_MAX_MEMORY || "512M",
      kill_timeout: 25000,
      listen_timeout: 10000,
      wait_ready: false,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "development",
        PORT: 3001,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: process.env.PORT || 3001,
      },
      out_file: "logs/pm2-out.log",
      error_file: "logs/pm2-error.log",
      merge_logs: true,
      time: true,
    },
  ],
};
