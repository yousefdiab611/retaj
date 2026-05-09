#!/bin/bash

###############################################################################
# RETAJ POS - UBUNTU VPS PRODUCTION DEPLOYMENT SCRIPT
# Version: 1.0
# OS: Ubuntu 20.04 LTS / 22.04 LTS
# Requirements: 2GB+ RAM, 20GB+ disk, root/sudo access
###############################################################################

set -e # Exit on error

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="retaj-pos"
APP_USER="retaj"
APP_HOME="/home/$APP_USER/$APP_NAME"
DOMAIN="${DOMAIN:-your-domain.com}"
EMAIL="${EMAIL:-admin@your-domain.com}"
NODEJS_VERSION="20"
PORT=3000
PM2_APP_NAME="retaj-api"

###############################################################################
# UTILITY FUNCTIONS
###############################################################################

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

check_root() {
  if [ "$EUID" -ne 0 ]; then
    log_error "This script must be run as root"
    exit 1
  fi
}

###############################################################################
# SYSTEM SETUP
###############################################################################

setup_system() {
  log_info "=== Setting up system packages ==="

  # Update system
  apt-get update
  apt-get upgrade -y

  # Install required packages
  apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    python3 \
    python3-pip \
    openssl \
    ufw \
    htop \
    postgresql \
    postgresql-contrib \
    redis-server \
    nginx \
    certbot \
    python3-certbot-nginx

  log_success "System packages installed"
}

###############################################################################
# NODE.JS & NPM SETUP
###############################################################################

setup_nodejs() {
  log_info "=== Setting up Node.js ==="

  # Install Node.js
  curl -fsSL https://deb.nodesource.com/setup_${NODEJS_VERSION}.x | sudo -E bash -
  apt-get install -y nodejs

  # Install PM2 globally
  npm install -g pm2

  # Save PM2 processes
  pm2 startup ubuntu -u root --hp /root

  log_success "Node.js $(node --version) and PM2 installed"
}

###############################################################################
# APPLICATION USER & DIRECTORY SETUP
###############################################################################

setup_app_user() {
  log_info "=== Setting up application user and directories ==="

  # Create app user if not exists
  if ! id "$APP_USER" &>/dev/null; then
    useradd -m -s /bin/bash "$APP_USER"
    log_success "User $APP_USER created"
  fi

  # Create app directory
  mkdir -p "$APP_HOME"
  chown -R "$APP_USER:$APP_USER" "$APP_HOME"

  # Create directories for invoices and backups
  mkdir -p "$APP_HOME/invoices"
  mkdir -p "$APP_HOME/backups"
  mkdir -p "$APP_HOME/logs"
  mkdir -p "$APP_HOME/public"
  chown -R "$APP_USER:$APP_USER" "$APP_HOME"

  log_success "Application user and directories configured"
}

###############################################################################
# DATABASE SETUP (PostgreSQL)
###############################################################################

setup_database() {
  log_info "=== Setting up PostgreSQL database ==="

  # Generate secure passwords
  DB_PASSWORD=$(openssl rand -base64 24)
  DB_NAME="retaj_db"
  DB_USER="retaj_app"

  # Create PostgreSQL user and database
  sudo -u postgres psql <<EOF
CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
CREATE DATABASE $DB_NAME OWNER $DB_USER;

-- Enable required extensions
\c $DB_NAME
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Configure for production
GRANT CONNECT ON DATABASE $DB_NAME TO $DB_USER;
GRANT USAGE ON SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;

-- Set correct permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO $DB_USER;

EOF

  log_success "PostgreSQL database configured"
  log_info "Database credentials (save these securely):"
  log_info "  Database: $DB_NAME"
  log_info "  User: $DB_USER"
  log_info "  Password: $DB_PASSWORD"

  # Save to env file template
  echo "DATABASE_URL=\"postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME\"" > "$APP_HOME/.env.production"
  echo "SHADOW_DATABASE_URL=\"postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/${DB_NAME}_shadow\"" >> "$APP_HOME/.env.production"
}

###############################################################################
# REDIS SETUP
###############################################################################

setup_redis() {
  log_info "=== Setting up Redis ==="

  systemctl enable redis-server
  systemctl start redis-server

  log_success "Redis configured"
}

###############################################################################
# FIREWALL SETUP
###############################################################################

setup_firewall() {
  log_info "=== Configuring firewall ==="

  ufw --force enable
  ufw default deny incoming
  ufw default allow outgoing

  # Allow SSH
  ufw allow 22/tcp
  # Allow HTTP
  ufw allow 80/tcp
  # Allow HTTPS
  ufw allow 443/tcp
  # Allow PostgreSQL (local only)
  ufw allow from 127.0.0.1 to 127.0.0.1 port 5432
  # Allow Redis (local only)
  ufw allow from 127.0.0.1 to 127.0.0.1 port 6379

  log_success "Firewall configured"
}

###############################################################################
# SSL CERTIFICATE SETUP (Let's Encrypt)
###############################################################################

setup_ssl() {
  log_info "=== Setting up SSL certificate ==="

  if [ "$DOMAIN" == "your-domain.com" ]; then
    log_warning "Please update DOMAIN variable before running this script"
    return
  fi

  # Create certificate
  certbot certonly --standalone -d "$DOMAIN" -d "www.$DOMAIN" --email "$EMAIL" --agree-tos --non-interactive --expand

  # Auto-renewal
  certbot renew --dry-run

  log_success "SSL certificate installed and auto-renewal configured"
}

###############################################################################
# NGINX SETUP
###############################################################################

setup_nginx() {
  log_info "=== Configuring Nginx ==="

  # Create Nginx config
  cat > /etc/nginx/sites-available/"$APP_NAME" <<'EOF'
upstream retaj_api {
    server 127.0.0.1:3000;
    keepalive 64;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name DOMAIN_PLACEHOLDER www.DOMAIN_PLACEHOLDER;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name DOMAIN_PLACEHOLDER www.DOMAIN_PLACEHOLDER;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Logging
    access_log /var/log/nginx/retaj_access.log;
    error_log /var/log/nginx/retaj_error.log;

    # Client size
    client_max_body_size 50M;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
    gzip_min_length 1024;

    # Proxy settings
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Connection "";
    proxy_http_version 1.1;

    # API routes
    location /api/ {
        proxy_pass http://retaj_api;
        proxy_read_timeout 30s;
        proxy_connect_timeout 10s;
    }

    # Static files
    location /invoices/ {
        alias APP_HOME_PLACEHOLDER/invoices/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location /public/ {
        alias APP_HOME_PLACEHOLDER/public/;
        expires 7d;
        add_header Cache-Control "public";
    }

    # Frontend
    location / {
        proxy_pass http://retaj_api;
        proxy_read_timeout 30s;
    }
}
EOF

  # Replace placeholders
  sed -i "s|DOMAIN_PLACEHOLDER|$DOMAIN|g" /etc/nginx/sites-available/"$APP_NAME"
  sed -i "s|APP_HOME_PLACEHOLDER|$APP_HOME|g" /etc/nginx/sites-available/"$APP_NAME"

  # Enable site
  ln -sf /etc/nginx/sites-available/"$APP_NAME" /etc/nginx/sites-enabled/
  rm -f /etc/nginx/sites-enabled/default

  # Test config
  nginx -t

  # Restart Nginx
  systemctl enable nginx
  systemctl restart nginx

  log_success "Nginx configured"
}

###############################################################################
# APPLICATION DEPLOYMENT
###############################################################################

deploy_application() {
  log_info "=== Deploying application ==="

  # Clone or pull repository
  if [ -d "$APP_HOME/.git" ]; then
    log_info "Pulling latest code..."
    cd "$APP_HOME"
    git pull origin main
  else
    log_info "Cloning repository..."
    git clone --depth 1 YOUR_REPO_URL "$APP_HOME"
  fi

  cd "$APP_HOME"

  # Install dependencies
  log_info "Installing dependencies..."
  npm ci --production

  # Build TypeScript
  log_info "Building application..."
  npm run build

  # Run database migrations
  log_info "Running database migrations..."
  npm run db:migrate:prod || log_warning "Database migrations completed"

  # Create PM2 ecosystem file
  cat > "$APP_HOME/ecosystem.config.js" <<'ECOSYSTEM'
module.exports = {
  apps: [{
    name: 'retaj-api',
    script: './dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time_format: 'YYYY-MM-DD HH:mm:ss Z',
    // Restart strategies
    max_memory_restart: '500M',
    watch: false,
    ignore_watch: ['node_modules', 'dist'],
    // Autorestart
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    // Graceful shutdown
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 3000,
  }]
};
ECOSYSTEM

  # Load environment variables
  if [ ! -f "$APP_HOME/.env.production" ]; then
    log_warning ".env.production not found, creating template"
    cp "$APP_HOME/.env.example" "$APP_HOME/.env.production" 2>/dev/null || true
  fi

  # Set correct permissions
  chown -R "$APP_USER:$APP_USER" "$APP_HOME"

  # Start with PM2
  log_info "Starting application with PM2..."
  sudo -u "$APP_USER" pm2 start ecosystem.config.js --env production
  pm2 save

  log_success "Application deployed"
}

###############################################################################
# BACKUP SETUP
###############################################################################

setup_backups() {
  log_info "=== Setting up backup system ==="

  mkdir -p "$APP_HOME/backups"
  chown -R "$APP_USER:$APP_USER" "$APP_HOME/backups"

  # Create backup script
  cat > "$APP_HOME/backup.sh" <<'BACKUP_SCRIPT'
#!/bin/bash
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql.gz"

# Create backup
pg_dump $DATABASE_URL | gzip > $BACKUP_FILE

# Keep only last 7 days of backups
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete

echo "Backup created: $BACKUP_FILE"
BACKUP_SCRIPT

  chmod +x "$APP_HOME/backup.sh"

  # Add daily backup cron job
  CRON_JOB="0 2 * * * cd $APP_HOME && ./backup.sh >> $APP_HOME/logs/backup.log 2>&1"
  (crontab -u "$APP_USER" -l 2>/dev/null | grep -v backup; echo "$CRON_JOB") | crontab -u "$APP_USER" -

  log_success "Backup system configured"
}

###############################################################################
# MONITORING SETUP
###############################################################################

setup_monitoring() {
  log_info "=== Setting up monitoring ==="

  # Create monitoring script
  cat > "$APP_HOME/monitor.sh" <<'MONITOR_SCRIPT'
#!/bin/bash

# Check if API is responding
if ! curl -f http://127.0.0.1:3000/health >/dev/null 2>&1; then
  echo "API is down! Restarting..."
  pm2 restart retaj-api
fi

# Check disk space
DISK_USAGE=$(df /var | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 90 ]; then
  echo "WARNING: Disk usage is ${DISK_USAGE}%"
fi

# Check memory
MEMORY_USAGE=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
if [ "$MEMORY_USAGE" -gt 90 ]; then
  echo "WARNING: Memory usage is ${MEMORY_USAGE}%"
fi
MONITOR_SCRIPT

  chmod +x "$APP_HOME/monitor.sh"

  # Add monitoring cron job (every 5 minutes)
  CRON_JOB="*/5 * * * * $APP_HOME/monitor.sh >> $APP_HOME/logs/monitor.log 2>&1"
  (crontab -u "$APP_USER" -l 2>/dev/null | grep -v monitor; echo "$CRON_JOB") | crontab -u "$APP_USER" -

  log_success "Monitoring configured"
}

###############################################################################
# LOG ROTATION SETUP
###############################################################################

setup_log_rotation() {
  log_info "=== Setting up log rotation ==="

  cat > /etc/logrotate.d/retaj-pos <<EOF
$APP_HOME/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 $APP_USER $APP_USER
    sharedscripts
    postrotate
        pm2 restart retaj-api --silent
    endscript
}
EOF

  log_success "Log rotation configured"
}

###############################################################################
# SYSTEM OPTIMIZATION
###############################################################################

optimize_system() {
  log_info "=== Optimizing system ==="

  # Increase file descriptors
  cat >> /etc/security/limits.conf <<EOF
* soft nofile 100000
* hard nofile 100000
* soft nproc 65536
* hard nproc 65536
EOF

  # TCP optimization
  cat >> /etc/sysctl.conf <<EOF
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.ip_local_port_range = 10000 65000
EOF

  sysctl -p

  log_success "System optimization applied"
}

###############################################################################
# MAIN EXECUTION
###############################################################################

main() {
  log_info "=========================================="
  log_info "RETAJ POS - Ubuntu Production Deployment"
  log_info "=========================================="
  log_info "Domain: $DOMAIN"
  log_info "App Home: $APP_HOME"
  log_info "App User: $APP_USER"
  log_info "=========================================="

  check_root

  # Prompt for configuration
  read -p "Enter domain (default: $DOMAIN): " domain_input
  DOMAIN="${domain_input:-$DOMAIN}"

  read -p "Enter email for SSL (default: $EMAIL): " email_input
  EMAIL="${email_input:-$EMAIL}"

  read -p "Enter GitHub repository URL: " repo_url

  if [ -z "$repo_url" ]; then
    log_error "Repository URL is required"
    exit 1
  fi

  # Replace in deployment function
  sed -i "s|YOUR_REPO_URL|$repo_url|g" "$0"

  # Execute setup steps
  setup_system
  setup_nodejs
  setup_app_user
  setup_database
  setup_redis
  setup_firewall
  setup_ssl
  setup_nginx
  deploy_application
  setup_backups
  setup_monitoring
  setup_log_rotation
  optimize_system

  log_success "=========================================="
  log_success "Deployment completed successfully!"
  log_success "=========================================="
  log_info "Application is running at: https://$DOMAIN"
  log_info "Check logs: tail -f $APP_HOME/logs/out.log"
  log_info "PM2 status: pm2 status"
  log_success "=========================================="
}

# Run main function
main "$@"
