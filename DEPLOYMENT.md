# RETAJ POS - Production Deployment Guide

## 🚀 Enterprise-Grade Invoice & Receipt System - Deployment Instructions

This guide covers deploying the fully upgraded RETAJ POS system with enterprise-grade invoice management, QR codes, thermal receipts, and complete production hardening.

---

## 📋 PRE-DEPLOYMENT CHECKLIST

- [ ] Ubuntu 20.04 LTS or 22.04 LTS VPS with 2GB+ RAM
- [ ] Domain registered and DNS configured
- [ ] Git repository SSH key configured
- [ ] PostgreSQL 12+ knowledge
- [ ] SSL certificate ready (auto-generated via Let's Encrypt)
- [ ] Root/sudo access to VPS

---

## 🏗️ SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────┐
│                    Client (Browser/POS)                      │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                   Nginx (Reverse Proxy)                      │
│              • SSL/TLS Termination                           │
│              • Load Balancing                                │
│              • Rate Limiting                                 │
│              • Static Files Caching                          │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│            Node.js Application (PM2)                         │
│              • Express API                                   │
│              • Invoice Processing                            │
│              • QR Code Generation                            │
│              • PDF Generation                                │
│              • Thermal Receipt Templates                     │
└────┬───────────────────────┬────────────────────────────────┘
     │                       │
┌────▼─────────┐      ┌──────▼──────────┐
│ PostgreSQL   │      │ Redis Cache     │
│ Database     │      │ (Optional)      │
└──────────────┘      └─────────────────┘
```

---

## 🔧 QUICK DEPLOYMENT (5 STEPS)

### Step 1: SSH to VPS

```bash
ssh root@your-vps-ip
```

### Step 2: Download Deployment Script

```bash
cd /tmp
wget https://raw.githubusercontent.com/your-org/retaj-pos/main/deploy.sh
chmod +x deploy.sh
```

### Step 3: Configure Deployment

Edit the script to set your variables:

```bash
DOMAIN="your-domain.com"
EMAIL="admin@your-domain.com"
APP_NAME="retaj-pos"
```

### Step 4: Run Deployment

```bash
./deploy.sh
```

The script will:
- ✅ Update system packages
- ✅ Install Node.js, PostgreSQL, Redis, Nginx
- ✅ Create application user
- ✅ Setup SSL certificate with Let's Encrypt
- ✅ Configure Nginx as reverse proxy
- ✅ Deploy application
- ✅ Setup PM2 process management
- ✅ Configure daily backups
- ✅ Setup monitoring
- ✅ Optimize system settings

### Step 5: Post-Deployment

```bash
# Check application status
pm2 status

# View logs
pm2 logs retaj-api

# Check if running
curl https://your-domain.com/health
```

---

## 🔐 SECURITY HARDENING

### 1. Environment Variables

**Create `.env.production` from template:**

```bash
cp backend/.env.production.example backend/.env.production
```

**Fill in all required secrets:**

```bash
# Generate JWT secrets
openssl rand -base64 32 > jwt_secret.txt
openssl rand -base64 32 > refresh_secret.txt

# Update .env.production with generated values
JWT_SECRET="<paste_first_secret>"
REFRESH_TOKEN_SECRET="<paste_second_secret>"
DATABASE_URL="postgresql://retaj_app:PASSWORD@localhost:5432/retaj_db"
```

### 2. Database Security

```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create strong password
\password retaj_app

# Enable SSL for remote connections (if needed)
# Edit /etc/postgresql/13/main/postgresql.conf
ssl = on
ssl_cert_file = '/etc/ssl/certs/ssl-cert-snakeoil.pem'
ssl_key_file = '/etc/ssl/private/ssl-cert-snakeoil.key'
```

### 3. Firewall Configuration

The deployment script automatically configures UFW:

```bash
# Verify firewall rules
ufw status numbered

# Rules should include:
# 22/tcp (SSH)
# 80/tcp (HTTP -> HTTPS redirect)
# 443/tcp (HTTPS)
# 5432/tcp (PostgreSQL - local only)
```

### 4. SSL Certificate Management

```bash
# Check certificate expiration
certbot certificates

# Manual renewal (runs automatically)
certbot renew --dry-run

# Force renewal
certbot renew --force-renewal
```

---

## 📦 DATABASE SETUP & MIGRATION

### Initial Setup

```bash
cd /home/retaj/retaj-pos

# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate:prod

# Seed database (optional)
npm run db:seed
```

### Backup & Restore

```bash
# Manual backup
pg_dump retaj_db | gzip > backup_$(date +%s).sql.gz

# Restore from backup
gunzip < backup_file.sql.gz | psql retaj_db
```

---

## 🚨 MONITORING & LOGGING

### Check Application Status

```bash
# PM2 status dashboard
pm2 monit

# View real-time logs
pm2 logs retaj-api --lines 100 --format

# View specific error logs
tail -f /home/retaj/retaj-pos/logs/err.log
```

### System Monitoring

```bash
# View system resources
htop

# Check disk space
df -h

# Check PostgreSQL status
systemctl status postgresql

# Check Nginx status
systemctl status nginx

# Check Redis status
systemctl status redis-server
```

### Application Health

```bash
# Check API health endpoint
curl https://your-domain.com/health

# Check database connectivity
curl https://your-domain.com/api/auth/health

# Monitor uptime
pm2 web  # Starts web dashboard on port 9615
```

---

## 📊 BACKUP & DISASTER RECOVERY

### Automatic Backups

The deployment script creates daily backups at 2 AM:

```bash
# View backup location
ls -lah /home/retaj/retaj-pos/backups/

# Check backup schedule
sudo crontab -u retaj -l

# Manual backup
/home/retaj/retaj-pos/backup.sh
```

### Restore from Backup

```bash
# Decompress backup
gunzip backup_20240128_020000.sql.gz

# Restore to database
psql retaj_db < backup_20240128_020000.sql

# Verify restoration
psql retaj_db -c "SELECT COUNT(*) FROM customers;"
```

### Off-Server Backup

```bash
# SCP backup to local machine
scp root@your-domain.com:/home/retaj/retaj-pos/backups/* ./backups/

# Upload to S3 (recommended)
aws s3 sync /home/retaj/retaj-pos/backups s3://your-backup-bucket/retaj/
```

---

## 🔄 UPDATES & DEPLOYMENTS

### Deploy New Version

```bash
cd /home/retaj/retaj-pos

# Pull latest code
git pull origin main

# Install new dependencies (if any)
npm ci --production

# Build application
npm run build

# Run migrations (if database schema changed)
npm run db:migrate:prod

# Restart with zero downtime
pm2 restart retaj-api --update-env

# Verify
pm2 logs retaj-api --lines 50
```

### Rollback to Previous Version

```bash
cd /home/retaj/retaj-pos

# Check git history
git log --oneline -10

# Rollback to specific commit
git reset --hard <commit-hash>

# Rebuild and restart
npm run build
pm2 restart retaj-api
```

---

## 🐛 TROUBLESHOOTING

### Application Won't Start

```bash
# Check PM2 logs
pm2 logs retaj-api --err

# Check if port 3000 is available
lsof -i :3000

# Manual test
npm run dev

# Check Node.js version
node --version
```

### Database Connection Issues

```bash
# Test PostgreSQL connection
psql -h localhost -U retaj_app -d retaj_db -c "SELECT NOW();"

# Check PostgreSQL service
systemctl status postgresql

# View PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*.log
```

### Nginx Issues

```bash
# Test Nginx configuration
nginx -t

# Check Nginx error logs
tail -f /var/log/nginx/retaj_error.log

# Restart Nginx
systemctl restart nginx
```

### SSL Certificate Issues

```bash
# Check certificate status
certbot certificates

# Renew certificate manually
certbot renew --force-renewal

# Check Nginx SSL configuration
openssl s_client -connect your-domain.com:443
```

---

## 📈 PERFORMANCE TUNING

### Optimize Nginx

```nginx
# Edit /etc/nginx/sites-available/retaj-pos

# Increase worker connections
events {
    worker_connections 10000;
}

# Enable caching
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m;
proxy_cache api_cache;
proxy_cache_valid 200 302 10m;
```

### Optimize Node.js

```bash
# Edit ecosystem.config.js

module.exports = {
  apps: [{
    name: 'retaj-api',
    script: './dist/index.js',
    instances: 'max',        # Use all CPU cores
    exec_mode: 'cluster',
    max_memory_restart: '500M',
    node_args: '--max-old-space-size=2048'  # Increase memory
  }]
};

pm2 restart ecosystem.config.js --update-env
```

### Database Query Optimization

```bash
# Connect to database
psql retaj_db

# View slow queries
SELECT query, calls, mean_time FROM pg_stat_statements 
ORDER BY mean_time DESC LIMIT 10;

# Create indexes
CREATE INDEX idx_transactions_customer ON transactions(customer_id);
CREATE INDEX idx_invoices_status ON invoices(status);
```

---

## 💰 INVOICE SYSTEM FEATURES

### Payment & Balance Tracking

- Automatic calculation of invoice total, paid amount, remaining balance
- Customer previous balance tracking
- Total outstanding amount calculation (previous balance + remaining)
- Support for cash customers (no balance tracking)

### Customer Account Info

- Customer name and phone display
- Last payment date tracking
- Previous invoice count
- Credit limit display
- Short statement of last 5 transactions

### Loyalty Points

- Automatic point calculation based on transaction amount
- Loyalty point rate configuration (e.g., 1 point per 1 SAR)
- Point balance tracking
- Reward threshold calculation

### Professional Receipt Design

- Store logo and branding
- Branch and cashier information
- Item-by-item breakdown
- Tax and discount calculations
- Payment method display
- Thank you message

### QR Code Generation

- QR code containing invoice number, total, date, customer name
- Verification URL support
- Display on PDF invoices, thermal receipts, and A4 prints
- Mobile verification capability

### Multiple Print Formats

- **80mm Thermal Receipt**: Full-width thermal printer format
- **58mm Thermal Receipt**: Narrow thermal printer format
- **A4 PDF Invoice**: Professional full-page invoice
- **Reprint Previous Invoices**: Archive and reprint functionality

### Arabic RTL Support

- Proper right-to-left text alignment
- Arabic date formatting
- Arabic labels and messages
- Professional Arabic typography

### Admin Configuration

- Logo upload
- Footer message customization
- Loyalty point rate adjustment
- Invoice color scheme
- QR code visibility toggle
- Customer balance visibility toggle
- Thermal print size selection

---

## 📱 MOBILE & OFFLINE SUPPORT

The system includes offline POS functionality:

```bash
# Offline sales queue
# The app will queue sales when offline and sync when reconnected

# To clear offline queue (if needed)
localStorage.clear()

# Verify offline data
localStorage.getItem('pendingSales')
```

---

## 🔗 USEFUL COMMANDS

```bash
# Start application
pm2 start ecosystem.config.js

# Stop application
pm2 stop retaj-api

# Restart application
pm2 restart retaj-api

# Delete application from PM2
pm2 delete retaj-api

# View logs
pm2 logs retaj-api

# Monitor in real-time
pm2 monit

# Save PM2 state
pm2 save

# Restore PM2 state on reboot
pm2 startup

# Check running processes
pm2 list

# Generate startup script
pm2 startup systemd -u retaj --hp /home/retaj
```

---

## 📞 SUPPORT & DOCUMENTATION

- **API Documentation**: https://your-domain.com/api-docs
- **Invoice Settings**: https://your-domain.com/admin/invoice-settings
- **Customer Portal**: https://your-domain.com/customer
- **Admin Dashboard**: https://your-domain.com/admin

---

## ✅ PRODUCTION READINESS CHECKLIST

- [ ] SSL certificate installed and auto-renewing
- [ ] Database backups running daily
- [ ] Monitoring and alerts configured
- [ ] Log rotation enabled
- [ ] Firewall properly configured
- [ ] Database optimized with indexes
- [ ] Environment variables secured
- [ ] PM2 configured for auto-restart
- [ ] Nginx caching enabled
- [ ] Performance tested under load
- [ ] Disaster recovery plan documented
- [ ] Team trained on operations

---

## 🎉 SUCCESS!

Your RETAJ POS system is now production-ready with:

✅ Enterprise-grade invoice management  
✅ QR code generation and verification  
✅ Thermal receipt printing (80mm & 58mm)  
✅ Professional PDF invoices  
✅ Customer loyalty points system  
✅ Multi-language (Arabic/English) support  
✅ Complete payment and balance tracking  
✅ Daily automated backups  
✅ Real-time monitoring and logging  
✅ SSL/TLS encryption  
✅ Firewall protection  
✅ Zero-downtime deployments  

**Start serving your customers with confidence!** 🚀
