# ⚡ RETAJ STORE - QUICK START GUIDE

## 🎯 TL;DR - Get Running in 5 Minutes

### Step 1: Setup Database (First Time Only)
```sql
CREATE USER retaj_user WITH PASSWORD 'RetajPass123!';
CREATE DATABASE retaj_db OWNER retaj_user;
```

### Step 2: Run Everything
```powershell
cd d:\retaj
.\run-all.ps1
```

### Step 3: Install Desktop App
- Find the installer: `d:\retaj\dist-electron\RetajPOS Setup X.X.X.exe`
- Run the installer as administrator
- The desktop app will handle everything automatically

### Step 4: Login
- **Username:** `ahmed`
- **Password:** `ahmed123`

---

## 📝 Available Scripts

### Main Build System (All Platforms)

| Platform | Command |
|----------|---------|
| Windows (PowerShell) | `.\run-all.ps1` |
| Windows (Batch) | `run-all.bat` |
| macOS/Linux (Bash) | `./run-all.sh` |
| Skip Mobile | `.\run-all.ps1 -SkipMobile` |

### Development Servers

```bash
# Backend API (http://localhost:3001)
cd backend && npm run dev

# Frontend Web (http://localhost:5173)
cd frontend && npm run dev

# Mobile (requires Flutter)
cd mobile_cashier && flutter run
```

### Database Management

```bash
# View database visually
cd backend && npm run db:studio

# Reset and reseed
cd backend && npx prisma migrate reset && npm run db:seed

# Create migration
cd backend && npx prisma migrate dev --name migration_name
```

### Production Builds

```bash
# Backend (production)
cd backend && npm run build && npm start

# Frontend (production)
cd frontend && npm run build
# Deploy contents of frontend/dist

# Mobile APK
cd mobile_cashier && flutter build apk --release
```

---

## 🔑 Login Credentials

After running `npm run db:seed`:

| User | Password | Role |
|------|----------|------|
| `ahmed` | `ahmed123` | Full Access |
| `ahmed` | `ahmed123` | POS Only |

---

## 📁 Important Paths

```
d:\retaj/
├── backend/dist/          ← API production build
├── frontend/dist/         ← Web production build
├── mobile_cashier/build/  ← Mobile APK (if built)
├── run-all.ps1           ← Build script
└── CREDENTIALS_AND_SETUP.md  ← Full setup guide
```

---

## ❓ Common Issues

| Issue | Solution |
|-------|----------|
| "Cannot connect to database" | Ensure PostgreSQL is running, check credentials |
| "Login failed" | Run `npm run db:seed` to create test users |
| "Frontend can't reach API" | Check backend is running on port 3001 |
| "npm command not found" | Install Node.js 18+ |
| "Flutter not found" | Install Flutter or use `-SkipMobile` flag |

---

**More Details:** See [CREDENTIALS_AND_SETUP.md](CREDENTIALS_AND_SETUP.md) and [RUN_SYSTEM_README.md](RUN_SYSTEM_README.md)
