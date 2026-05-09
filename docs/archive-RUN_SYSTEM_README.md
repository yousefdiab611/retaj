# 🚀 RETAJ STORE - Full Project Run System

Complete automation system for building the entire Retaj Store Management System in one command.

## 📋 Features

✅ **Unified Build System** - Backend, Frontend, and Mobile in one command
✅ **Error Handling** - Graceful failure handling per module
✅ **Colored Output** - Clear visual feedback (green=success, red=error, cyan=info)
✅ **Progress Tracking** - Step-by-step build progress
✅ **Platform Support** - Windows (PowerShell/Batch), Linux/Mac (Bash)
✅ **No Business Logic Changes** - Pure automation layer
✅ **Production Ready** - Optimized builds with proper configuration

---

## 📁 Project Structure

```
retaj/
├── backend/              # Node.js + Express + Prisma
├── frontend/             # React + Vite
├── mobile_cashier/       # Flutter mobile app
├── run-all.ps1          # PowerShell (recommended for Windows)
├── run-all.bat          # Batch script (Command Prompt fallback)
└── run-all.sh           # Bash (Linux/Mac)
```

---

## 🔧 Prerequisites

### Windows
- **Node.js** 18+ (with npm)
- **PowerShell** 5.1+ or Command Prompt
- **PostgreSQL** 12+ (for database)

### macOS/Linux
- **Node.js** 18+ (with npm)
- **Bash** shell
- **PostgreSQL** 12+ (for database)

### Mobile (Optional)
- **Flutter SDK** 3.0+ (only if building mobile)

---

## ⚙️ Database Setup

Before running the build system, set up PostgreSQL:

### Create Database & User

```sql
-- Connect to PostgreSQL as admin
CREATE USER retaj_user WITH PASSWORD 'RetajPass123!';
CREATE DATABASE retaj_db OWNER retaj_user;
GRANT ALL PRIVILEGES ON DATABASE retaj_db TO retaj_user;
```

Or using command line:
```bash
# Windows (if pg_sql available)
psql -U postgres -c "CREATE USER retaj_user WITH PASSWORD 'RetajPass123!';"
psql -U postgres -c "CREATE DATABASE retaj_db OWNER retaj_user;"

# macOS/Linux
sudo -u postgres psql -c "CREATE USER retaj_user WITH PASSWORD 'RetajPass123!';"
sudo -u postgres psql -c "CREATE DATABASE retaj_db OWNER retaj_user;"
```

The `.env` files are pre-configured with these credentials.

---

## 🎯 Quick Start

### Windows (PowerShell - Recommended)

```powershell
# Navigate to project root
cd d:\retaj

# Run the complete build system
.\run-all.ps1

# To skip mobile build (faster)
.\run-all.ps1 -SkipMobile
```

### Windows (Command Prompt)

```cmd
cd d:\retaj
run-all.bat
```

### macOS/Linux

```bash
cd ~/retaj
chmod +x run-all.sh
./run-all.sh
```

---

## 📊 What the Script Does

### 1. **Backend Setup**
```
[INFO] Running: npm install
[INFO] Running: npx prisma generate
[INFO] Running: npm run build
Output → backend/dist
```

### 2. **Frontend Setup**
```
[INFO] Running: npm install
[INFO] Running: npm run build
Output → frontend/dist
```

### 3. **Mobile Setup** (Optional)
```
[INFO] Running: flutter pub get
[INFO] Running: flutter build apk --release
Output → mobile_cashier/build/app/outputs/flutter-apk
```

### 4. **Summary Report**
```
✔ Backend ready → d:\retaj\backend\dist
✔ Frontend ready → d:\retaj\frontend\dist
✔ Mobile ready → d:\retaj\mobile_cashier\build\app\outputs\flutter-apk
⏱ Execution Time: 450.23 seconds
```

---

## 📝 Environment Files

### Backend Configuration (`backend/.env`)
```dotenv
DATABASE_URL="postgresql://retaj_user:RetajPass123!@localhost:5432/retaj_db"
PORT=3001
NODE_ENV=development
JWT_SECRET="retaj-dev-secret-key-change-for-production"
ALLOWED_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
```

### Frontend Configuration (`frontend/.env`)
```dotenv
# Leave empty to use Vite proxy, or specify API URL
# VITE_API_URL=http://localhost:3001
```

---

## 🚀 Running Individual Modules

After the build system completes, you can run modules separately:

### Backend (Development)
```bash
cd backend
npm run dev
# Server runs on http://localhost:3001
```

### Backend (Production)
```bash
cd backend
npm start
# Server runs on specified PORT
```

### Frontend (Development)
```bash
cd frontend
npm run dev
# Frontend runs on http://localhost:5173
```

### Frontend (Production)
```bash
cd frontend
npm run build  # Already done by run-all
# Deploy frontend/dist folder
```

### Mobile (Development)
```bash
cd mobile_cashier
flutter run
```

### Mobile (Production)
```bash
cd mobile_cashier
flutter build apk --release   # Already done by run-all
flutter build ios --release   # Additional iOS build
```

---

## 👤 Default Test Credentials

After database setup, seed test users with:

```bash
cd backend
npm run db:seed
```

**Test Users:**
| Username | Password | Role |
|----------|----------|------|
| `admin` | `Admin@123!` | ADMIN |
| `manager` | `Manager@123!` | MANAGER |
| `cashier` | `Cashier@123!` | CASHIER |

> ⚠️ **Production:** Change these credentials immediately!

---

## ❌ Error Handling

The build system **does NOT stop** if one module fails. It continues with other modules and provides a summary:

```
⚠ [BACKEND ERROR] npm install failed
✔ [FRONTEND SUCCESS] Built successfully
⚠ [MOBILE ERROR] Flutter not found

Build completed with 2 error(s)
```

### Common Issues

**PostgreSQL Connection Error**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
Solution: Ensure PostgreSQL is running and credentials in `.env` are correct.

**Flutter Not Found**
```
⚠ Flutter not found. Skipping mobile build.
```
Solution: Install Flutter SDK or use `-SkipMobile` flag in PowerShell.

**npm: command not found**
```
Error: npm: command not found
```
Solution: Install Node.js 18+ from https://nodejs.org/

---

## 📁 Build Output Locations

After successful build:

| Module | Location | Purpose |
|--------|----------|---------|
| Backend | `backend/dist` | Production API files |
| Frontend | `frontend/dist` | Production web files |
| Mobile | `mobile_cashier/build/app/outputs/flutter-apk` | APK file for Android |

---

## 🔒 Security Notes

- ⚠️ Change `JWT_SECRET` in `backend/.env` for production (minimum 32 characters)
- ⚠️ Update database credentials from defaults
- ⚠️ Set proper `ALLOWED_ORIGINS` for production
- ⚠️ Never commit `.env` files to version control (already in `.gitignore`)
- ⚠️ Use HTTPS in production for API and frontend

---

## 📊 Execution Time Estimates

- **Complete Build:** 3-5 minutes (without mobile)
- **Mobile Build:** +5-10 minutes (resource-intensive)
- **Backend Only:** 30-60 seconds
- **Frontend Only:** 30-60 seconds

> Times vary based on system specs and network speed.

---

## 🐛 Troubleshooting

### All modules fail
Check that Node.js is installed:
```bash
node --version
npm --version
```

### Database connection fails
Verify PostgreSQL is running and credentials are correct:
```bash
psql -U retaj_user -d retaj_db -h localhost
```

### Frontend can't connect to backend
Ensure backend is running and `ALLOWED_ORIGINS` in `backend/.env` includes frontend URL.

### Mobile build is slow
Flutter builds are resource-intensive. Use `-SkipMobile` flag to skip during development:
```powershell
.\run-all.ps1 -SkipMobile
```

---

## 📚 Additional Documentation

- Backend API: See `backend/README.md` (if exists)
- Frontend UI: See `frontend/README.md` (if exists)
- Mobile App: See `mobile_cashier/README.md`

---

## 📞 Support

For issues or questions, check:
1. Database connection (PostgreSQL running?)
2. Node.js version (18+?)
3. Environment files (`.env` properly configured?)
4. Error logs (see console output)

---

## 📄 License

RETAJ STORE © 2024-2026. All rights reserved.

---

**Last Updated:** April 24, 2026
**Version:** 1.0.0
**Platforms:** Windows (PowerShell/Batch), macOS/Linux (Bash)
