# Clinic DBMS - Database Connection Setup Guide

## Overview
This guide will help you connect your React Clinic DBMS project to a real MySQL database and set up a Node.js/Express backend API.

---

## PART 1: DATABASE SETUP

### Step 1: Install MySQL (if not already installed)

**Windows:**
- Download from: https://dev.mysql.com/downloads/mysql/
- Run installer and follow installation wizard
- Remember your root password and port (default: 3306)

**Mac:**
```bash
brew install mysql
brew services start mysql
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install mysql-server
sudo mysql_secure_installation
```

### Step 2: Create the Database

1. Open MySQL Command Line Client or MySQL Workbench
2. Login with your root credentials
3. Copy and paste the entire contents from `CLINIC_DATABASE_SCHEMA.sql`
4. Execute all queries
5. Verify tables were created:
```sql
USE ayurkaya_clinic_db;
SHOW TABLES;
```

**Alternative - Using Command Line:**
```bash
mysql -u root -p < CLINIC_DATABASE_SCHEMA.sql
```

---

## PART 2: BACKEND API SETUP (Express.js)

### Step 3: Install Backend Dependencies

Navigate to your project root and install required packages:

```bash
npm install express cors dotenv mysql2/promise bcryptjs jsonwebtoken axios body-parser
npm install --save-dev nodemon
```

**Package descriptions:**
- `express` - Web framework
- `cors` - Enable cross-origin requests
- `dotenv` - Environment variables
- `mysql2/promise` - MySQL database driver
- `bcryptjs` - Password hashing
- `jsonwebtoken` - Authentication tokens
- `nodemon` - Auto-restart server on changes

### Step 4: Create Backend Folder Structure

```bash
mkdir -p server
mkdir -p server/config
mkdir -p server/routes
mkdir -p server/controllers
mkdir -p server/middleware
mkdir -p server/utils
```

### Step 5: Create Environment File

Create `server/.env`:

```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=ayurkaya_clinic_db
DB_PORT=3306

# Server Configuration
SERVER_PORT=5000
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_change_this
JWT_EXPIRE=7d

# CORS Configuration
CORS_ORIGIN=http://localhost:5173
```

### Step 6: Create Database Connection Pool

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

### Step 7: Create Authentication Middleware

Create `server/middleware/auth.js`:

```javascript
import jwt from 'jsonwebtoken';

export const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.doctor_id = decoded.doctor_id;
    req.doctorEmail = decoded.email;
    next();
  });
};

export const optionalAuth = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  
  if (token) {
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (!err) {
        req.doctor_id = decoded.doctor_id;
      }
    });
  }
  next();
};
```

### Step 8: Create Auth Controller

Create `server/controllers/authController.js`:

```javascript
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const connection = await pool.getConnection();
    const [doctors] = await connection.query(
      'SELECT * FROM doctors WHERE email = ?',
      [email]
    );
    connection.release();

    if (doctors.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const doctor = doctors[0];
    const passwordMatch = await bcrypt.compare(password, doctor.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { doctor_id: doctor.id, email: doctor.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );

    res.json({
      success: true,
      token,
      doctor: {
        id: doctor.id,
        name: doctor.name,
        email: doctor.email,
        role: doctor.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const register = async (req, res) => {
  try {
    const { email, password, name, passcode, qualifications } = req.body;

    const connection = await pool.getConnection();
    
    // Check if doctor exists
    const [existing] = await connection.query(
      'SELECT id FROM doctors WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      connection.release();
      return res.status(400).json({ error: 'Doctor already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await connection.query(
      'INSERT INTO doctors (email, password, name, passcode, qualifications) VALUES (?, ?, ?, ?, ?)',
      [email, hashedPassword, name, passcode, qualifications]
    );

    connection.release();

    res.status(201).json({
      success: true,
      message: 'Doctor registered successfully'
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
```

### Step 9: Create Patient Routes

Create `server/routes/patientRoutes.js`:

```javascript
import express from 'express';
import pool from '../config/database.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Get all patients
router.get('/patients', verifyToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [patients] = await connection.query(
      'SELECT * FROM patients_registry ORDER BY created_date DESC'
    );
    connection.release();
    res.json(patients);
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single patient
router.get('/patients/:patientId', verifyToken, async (req, res) => {
  try {
    const { patientId } = req.params;
    const connection = await pool.getConnection();
    
    const [patients] = await connection.query(
      'SELECT * FROM patients_registry WHERE patientId = ?',
      [patientId]
    );
    
    if (patients.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Patient not found' });
    }

    const [cases] = await connection.query(
      'SELECT * FROM cases WHERE patientId = ? ORDER BY case_date DESC',
      [patientId]
    );

    connection.release();
    
    res.json({
      patient: patients[0],
      cases
    });
  } catch (error) {
    console.error('Error fetching patient:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create patient
router.post('/patients', verifyToken, async (req, res) => {
  try {
    const { patientId, name, age, gender, mobile, occupation, email, address } = req.body;
    const connection = await pool.getConnection();

    await connection.query(
      'INSERT INTO patients_registry (patientId, name, age, gender, mobile, occupation, email, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [patientId, name, age, gender, mobile, occupation, email, address]
    );

    connection.release();
    res.status(201).json({ success: true, patientId });
  } catch (error) {
    console.error('Error creating patient:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update patient
router.put('/patients/:patientId', verifyToken, async (req, res) => {
  try {
    const { patientId } = req.params;
    const { name, age, gender, mobile, occupation, email, address } = req.body;
    const connection = await pool.getConnection();

    await connection.query(
      'UPDATE patients_registry SET name=?, age=?, gender=?, mobile=?, occupation=?, email=?, address=? WHERE patientId=?',
      [name, age, gender, mobile, occupation, email, address, patientId]
    );

    connection.release();
    res.json({ success: true, message: 'Patient updated' });
  } catch (error) {
    console.error('Error updating patient:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete patient
router.delete('/patients/:patientId', verifyToken, async (req, res) => {
  try {
    const { patientId } = req.params;
    const connection = await pool.getConnection();

    await connection.query(
      'DELETE FROM patients_registry WHERE patientId = ?',
      [patientId]
    );

    connection.release();
    res.json({ success: true, message: 'Patient deleted' });
  } catch (error) {
    console.error('Error deleting patient:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
```

### Step 10: Create Main Server File

Create `server/index.js`:

```javascript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import patientRoutes from './routes/patientRoutes.js';
import caseRoutes from './routes/caseRoutes.js';
import queueRoutes from './routes/queueRoutes.js';

dotenv.config({ path: './server/.env' });

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', patientRoutes);
app.use('/api', caseRoutes);
app.use('/api', queueRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.SERVER_PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

### Step 11: Create Auth Routes

Create `server/routes/authRoutes.js`:

```javascript
import express from 'express';
import { login, register } from '../controllers/authController.js';

const router = express.Router();

router.post('/login', login);
router.post('/register', register);

export default router;
```

### Step 12: Update package.json Scripts

Update your `package.json` to include:

```json
"scripts": {
  "dev": "vite",
  "server": "nodemon server/index.js",
  "build": "vite build",
  "lint": "eslint .",
  "preview": "vite preview",
  "dev:all": "concurrently \"npm run server\" \"npm run dev\""
}
```

Install concurrently:
```bash
npm install --save-dev concurrently
```

---

## PART 3: FRONTEND API INTEGRATION

### Step 13: Create API Service in Frontend

Create `src/services/api.js`:

```javascript
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth APIs
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data)
};

// Patient APIs
export const patientAPI = {
  getAll: () => api.get('/patients'),
  getById: (patientId) => api.get(`/patients/${patientId}`),
  create: (data) => api.post('/patients', data),
  update: (patientId, data) => api.put(`/patients/${patientId}`, data),
  delete: (patientId) => api.delete(`/patients/${patientId}`)
};

// Case APIs
export const caseAPI = {
  getAll: () => api.get('/cases'),
  getById: (caseId) => api.get(`/cases/${caseId}`),
  create: (data) => api.post('/cases', data),
  update: (caseId, data) => api.put(`/cases/${caseId}`, data),
  delete: (caseId) => api.delete(`/cases/${caseId}`)
};

// Queue APIs
export const queueAPI = {
  getAll: () => api.get('/queue'),
  add: (data) => api.post('/queue', data),
  updateStatus: (queueId, status) => api.put(`/queue/${queueId}`, { status })
};

export default api;
```

### Step 14: Update Login Component to Use API

Update your `src/pages/Login.jsx` to use the API:

```javascript
import { authAPI } from '../services/api';

const handleSignIn = async (e) => {
  e.preventDefault();
  setErrorMsg("");
  
  try {
    const response = await authAPI.login(email, password);
    const { token, doctor } = response.data;
    
    localStorage.setItem('auth_token', token);
    localStorage.setItem('doctor_info', JSON.stringify(doctor));
    
    setSuccessMsg("Login successful!");
    setTimeout(() => navigate('/dashboard'), 1500);
  } catch (error) {
    setErrorMsg(error.response?.data?.error || 'Login failed');
  }
};
```

---

## PART 4: RUNNING THE PROJECT

### Step 15: Start Both Frontend and Backend

**Option 1: In Separate Terminals**

Terminal 1 - Backend:
```bash
npm run server
```

Terminal 2 - Frontend:
```bash
npm run dev
```

**Option 2: Both at Once**
```bash
npm run dev:all
```

### Step 16: Test the Connection

1. Open `http://localhost:5173` in your browser
2. Try logging in with:
   - Email: `drneha@ayurkaya.com`
   - Password: `DrNehaAyurkaya1@`

---

## IMPORTANT SECURITY NOTES ⚠️

1. **Change default credentials** in database
2. **Hash passwords** before storing (use bcryptjs)
3. **Use HTTPS** in production
4. **Hide .env file** in .gitignore
5. **Validate all inputs** on server side
6. **Use prepared statements** to prevent SQL injection
7. **Implement rate limiting** for API endpoints
8. **Add request validation** using middleware

---

## TROUBLESHOOTING

### MySQL Connection Error
- Verify MySQL is running: `mysql -u root -p`
- Check `.env` credentials match your MySQL setup
- Ensure database exists: `SHOW DATABASES;`

### CORS Errors
- Check that backend is running on port 5000
- Verify CORS_ORIGIN in `.env` matches frontend URL
- Clear browser cache and restart

### Port Already in Use
```bash
# Kill process on port 5000
lsof -ti:5000 | xargs kill -9  # macOS/Linux
netstat -ano | findstr :5000    # Windows (find PID then: taskkill /PID <PID>)
```

### Token Issues
- Clear localStorage: `localStorage.clear()` in console
- Check JWT_SECRET in .env
- Ensure token is being sent in headers

---

## Next Steps - Additional Routes to Create

You'll also want to create these route files:
- `server/routes/caseRoutes.js` - Case/appointment management
- `server/routes/queueRoutes.js` - Queue management
- `server/routes/medicineRoutes.js` - Medicine inventory
- `server/routes/labRoutes.js` - Lab tests

Follow the same pattern as `patientRoutes.js` for these files.

---

## Database Backup & Restore

**Backup:**
```bash
mysqldump -u root -p ayurkaya_clinic_db > backup.sql
```

**Restore:**
```bash
mysql -u root -p ayurkaya_clinic_db < backup.sql
```

---

For questions or issues, refer to:
- MySQL Docs: https://dev.mysql.com/doc/
- Express Docs: https://expressjs.com/
- JWT Docs: https://jwt.io/
