# Quick Start Guide - Database & Backend Setup

## 📋 TL;DR - Complete Setup in 5 Minutes

### 1️⃣ Install MySQL Database

```bash
# Windows: Download from https://dev.mysql.com/downloads/mysql/
# Then login and execute:
mysql -u root -p < CLINIC_DATABASE_SCHEMA.sql

# Mac:
brew install mysql
brew services start mysql
mysql -u root -p < CLINIC_DATABASE_SCHEMA.sql

# Linux:
sudo apt-get install mysql-server
sudo mysql_secure_installation
mysql -u root -p < CLINIC_DATABASE_SCHEMA.sql
```

### 2️⃣ Install Backend Dependencies

```bash
cd your-project-folder
npm install express cors dotenv mysql2/promise bcryptjs jsonwebtoken body-parser
npm install --save-dev nodemon concurrently
```

### 3️⃣ Create Server Folder Structure

```bash
mkdir -p server/config
mkdir -p server/routes
mkdir -p server/controllers
mkdir -p server/middleware
```

### 4️⃣ Create `.env` File

Create `server/.env`:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=ayurkaya_clinic_db
DB_PORT=3306
SERVER_PORT=5000
NODE_ENV=development
JWT_SECRET=change_this_to_random_secure_string
CORS_ORIGIN=http://localhost:5173
```

### 5️⃣ Create Database Connection

Create `server/config/database.js`:
```javascript
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config({ path: './server/.env' });

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export default pool;
```

### 6️⃣ Create Server Main File

Create `server/index.js`:
```javascript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config({ path: './server/.env' });

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

const PORT = process.env.SERVER_PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
```

### 7️⃣ Update package.json Scripts

```json
"scripts": {
  "dev": "vite",
  "server": "nodemon server/index.js",
  "build": "vite build",
  "dev:all": "concurrently \"npm run server\" \"npm run dev\"",
  "lint": "eslint .",
  "preview": "vite preview"
}
```

### 8️⃣ Run Both Frontend & Backend

```bash
# Option 1: Single command (recommended)
npm run dev:all

# Option 2: Two separate terminals
# Terminal 1:
npm run server

# Terminal 2:
npm run dev
```

### 9️⃣ Test Connection

Open browser: `http://localhost:5173`
- Backend running: `http://localhost:5000/api/health`
- Database files ready: Check `CLINIC_DATABASE_SCHEMA.sql`

---

## 📁 File Structure After Setup

```
Clinic-DBMS-main/
├── src/
│   ├── App.jsx
│   ├── pages/
│   ├── components/
│   └── services/
├── server/
│   ├── config/
│   │   └── database.js
│   ├── controllers/
│   │   └── authController.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── patientRoutes.js
│   │   ├── caseRoutes.js
│   │   └── queueRoutes.js
│   ├── middleware/
│   │   └── auth.js
│   └── index.js
├── server/.env
├── CLINIC_DATABASE_SCHEMA.sql
├── DATABASE_CONNECTION_SETUP.md
└── package.json
```

---

## 🔌 API Endpoints Created

### Auth
- `POST /api/auth/login` - Doctor login
- `POST /api/auth/register` - Doctor registration

### Patients
- `GET /api/patients` - Get all patients
- `GET /api/patients/:id` - Get patient details
- `POST /api/patients` - Create patient
- `PUT /api/patients/:id` - Update patient
- `DELETE /api/patients/:id` - Delete patient

### Cases
- `GET /api/cases` - Get all cases
- `GET /api/cases/:id` - Get case details
- `POST /api/cases` - Create case
- `PUT /api/cases/:id` - Update case
- `DELETE /api/cases/:id` - Delete case
- `POST /api/cases/:id/medicines` - Add medicine
- `POST /api/cases/:id/lab-tests` - Add lab test

### Queue
- `GET /api/queue` - Get queue (today or by date)
- `GET /api/queue/:id` - Get queue item
- `POST /api/queue` - Add to queue
- `PUT /api/queue/:id` - Update queue status
- `DELETE /api/queue/:id` - Cancel queue entry

---

## ✅ Database Tables Created

1. `doctors` - Doctor accounts
2. `patients_registry` - Patient information
3. `cases` - Patient appointments/cases
4. `queue` - Daily queue management
5. `medicines` - Medicine inventory
6. `case_medicines` - Medicines prescribed per case
7. `lab_tests` - Lab test results
8. `chief_complaints` - Patient complaints
9. `audit_logs` - System activity log
10. `notifications` - Patient notifications

---

## 🧪 Test Login Credentials

Email: `drneha@ayurkaya.com`
Password: `DrNehaAyurkaya1@`

(These are seeded in the database by the schema file)

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| MySQL won't connect | Check `.env` credentials, ensure MySQL is running |
| Port 5000 already in use | Change `SERVER_PORT` in `.env` |
| CORS errors | Verify `CORS_ORIGIN` matches your frontend URL |
| Token errors | Clear localStorage, restart server |
| Database not found | Run the SQL schema file again |

---

## 📚 Next Steps

1. ✅ Copy all route files (patientRoutes.js, caseRoutes.js, queueRoutes.js)
2. ✅ Create auth controller (authController.js)
3. ✅ Create auth middleware (auth.js)
4. ✅ Create API service (src/services/api.js)
5. ✅ Update Login component to use API
6. ✅ Add error handling & validation
7. ✅ Deploy to production

---

## 🔐 Security Checklist

- [ ] Change JWT_SECRET to random string
- [ ] Use strong MySQL password
- [ ] Add input validation
- [ ] Use HTTPS in production
- [ ] Add rate limiting
- [ ] Implement request logging
- [ ] Add database backups
- [ ] Use prepared statements (already in routes)
- [ ] Add request timeout
- [ ] Sanitize user inputs

---

For detailed setup information, see `DATABASE_CONNECTION_SETUP.md`
