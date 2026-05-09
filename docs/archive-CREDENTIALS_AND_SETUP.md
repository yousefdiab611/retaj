# 🔐 RETAJ STORE - Test Credentials & Setup

## Database Setup (REQUIRED FIRST)

Before running the project, you must set up PostgreSQL and create the database.

### Step 1: Create PostgreSQL User & Database

Run these SQL commands in PostgreSQL (via pgAdmin, psql, or your preferred tool):

```sql
-- Create the user
CREATE USER retaj_user WITH PASSWORD 'RetajPass123!';

-- Create the database
CREATE DATABASE retaj_db OWNER retaj_user;

-- Grant all privileges
GRANT ALL PRIVILEGES ON DATABASE retaj_db TO retaj_user;

-- For schema operations (if needed)
\c retaj_db
GRANT ALL PRIVILEGES ON SCHEMA public TO retaj_user;
```

### Step 2: Verify Connection

Test the connection:

```bash
# Windows
psql -U retaj_user -d retaj_db -h localhost

# macOS/Linux
psql -U retaj_user -d retaj_db -h localhost
```

When prompted, enter password: `RetajPass123!`

---

## 🏃 Running the Project

### Option 1: Full Automated Build (Recommended)

```powershell
# Windows (PowerShell)
cd d:\retaj
.\run-all.ps1

# macOS/Linux
cd ~/retaj
chmod +x run-all.sh
./run-all.sh
```

**First Time Setup:**
The script will:

1. ✅ Install dependencies
2. ✅ Generate Prisma client
3. ✅ Compile backend TypeScript
4. ✅ Build frontend Vite bundle

**Result:** Backend ready on `http://localhost:3001`, Frontend ready for dev server

---

## 👤 Test Credentials

After first database setup, seed test data:

```bash
cd d:\retaj\backend
npm run db:seed
```

### Default Test Users

| Username  | Password                  | Role    | Purpose                             |
| --------- | ------------------------- | ------- | ----------------------------------- |
| `ahmed`   | `ahmed123`                | ADMIN   | Full system access, user management |
| `ahmed`   | `ahmed123`                | CASHIER | POS operations, sales               |
| `manager` | _(requires manual setup)_ | MANAGER | Inventory & reports                 |

---

## 🎯 Login Instructions

### Web Interface (http://localhost:5173)

1. Open browser → `http://localhost:5173`
2. Enter credentials:
   - **Username:** `ahmed`
   - **Password:** `ahmed123`
3. Click Login

### Backend API Direct Access

Test API with credentials:

```bash
# Login request
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"ahmed","password":"ahmed123"}'

# Response contains JWT token
# Use token in subsequent requests:
curl -H "Authorization: Bearer <TOKEN>" http://localhost:3001/api/users
```

---

## 📱 Running Individual Modules

### Backend (Development)

```bash
cd d:\retaj\backend
npm run dev
# Runs on http://localhost:3001 with hot reload
```

### Frontend (Development)

```bash
cd d:\retaj\frontend
npm run dev
# Runs on http://localhost:5173 with hot reload
```

### Mobile (If Flutter installed)

```bash
cd d:\retaj\mobile_cashier
flutter run
# Runs on connected device or emulator
```

---

## 🗄️ Database Management

### View Database in Prisma Studio

```bash
cd d:\retaj\backend
npm run db:studio
# Opens GUI at http://localhost:5555
```

### Reset Database (Caution!)

```bash
cd d:\retaj\backend
npx prisma migrate reset
# Deletes all data and runs migrations from scratch
npm run db:seed
# Recreates test data
```

### Generate New Migration

```bash
cd d:\retaj\backend
npx prisma migrate dev --name your_migration_name
```

---

## ⚙️ Environment Variables

### Backend Configuration (`backend/.env`)

```dotenv
DATABASE_URL="postgresql://retaj_user:RetajPass123!@localhost:5432/retaj_db"
PORT=3001
JWT_SECRET="your-secret-at-least-32-chars-in-production"
ALLOWED_ORIGINS="http://localhost:5173"
LOG_LEVEL=debug
```

### Frontend Configuration (`frontend/.env`)

```dotenv
# Leave empty to use proxy or specify backend URL
# VITE_API_URL=http://localhost:3001
```

---

## 🔄 API Integration

### Authentication Flow

1. **Login** → Get JWT token

   ```
   POST /api/auth/login
   Body: { username, password }
   Response: { access_token, refresh_token }
   ```

2. **Use Token** → Include in headers

   ```
   Authorization: Bearer <access_token>
   ```

3. **Select Branch** → For POS operations
   ```
   X-Branch-Id: <branch_id_from_database>
   ```

---

## 🐛 Troubleshooting

### "Cannot connect to database"

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:**

- Ensure PostgreSQL is running
- Verify credentials in `backend/.env`
- Check database exists: `psql -l`

### "Invalid login credentials"

```
Error: Login failed
```

**Solution:**

- Verify user exists: check Prisma Studio
- Run seed: `npm run db:seed`
- Reset database if needed: `npx prisma migrate reset`

### "Frontend can't reach backend"

```
Error: Failed to fetch /api/*
```

**Solution:**

- Ensure backend is running: `npm run dev` in backend folder
- Check `ALLOWED_ORIGINS` in `backend/.env`
- Add frontend URL to allowed origins

### "Module not found"

```
Error: Cannot find module 'xxx'
```

**Solution:**

- Run `npm install` in affected folder
- Delete `node_modules` and `package-lock.json`
- Reinstall: `npm install`

---

## 📊 Database Schema

Test data includes:

- **1 Main Store** (Default branch)
- **1 Main Warehouse** (Default warehouse)
- **12 Products** (Coffee, food, stationery)
- **3 Users** (Admin, Cashier, Manager roles)

### Example Branch ID

All users created have `branchId` set to the Main Store ID. Get it from:

```
Prisma Studio: http://localhost:5555 → Branch table
API: GET /api/branches (requires auth)
```

---

## ✨ Quick Commands Reference

```bash
# Build everything
.\run-all.ps1 (Windows) or ./run-all.sh (macOS/Linux)

# Start backend dev
cd backend && npm run dev

# Start frontend dev
cd frontend && npm run dev

# View database
cd backend && npm run db:studio

# Seed test data
cd backend && npm run db:seed

# Reset everything
cd backend && npx prisma migrate reset && npm run db:seed
```

---

## 📞 Support

For issues:

1. Check console output for specific error messages
2. Review logs: `backend/logs/` (if exists)
3. Check Prisma Studio: `npm run db:studio`
4. Verify `.env` files are configured
5. Ensure PostgreSQL is running and accessible

---

**Version:** 1.0.0  
**Last Updated:** April 24, 2026  
**Status:** Production Ready ✅
