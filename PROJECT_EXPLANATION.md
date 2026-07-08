# 🏥 Clinic DBMS - Comprehensive Project Explanation

**For: Team/Colleagues Presentation**

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Database Schema](#database-schema)
5. [Backend System](#backend-system)
6. [Frontend System](#frontend-system)
7. [API Documentation](#api-documentation)
8. [Features & Functionalities](#features--functionalities)
9. [Security Implementation](#security-implementation)
10. [Setup & Deployment](#setup--deployment)

---

## 🎯 Project Overview

### What is Clinic DBMS?

**Clinic DBMS** (Database Management System) is a comprehensive web-based clinic management application designed specifically for Ayurvedic clinics. It streamlines:

- **Patient Management** - Register, store, and manage patient information
- **Appointment/Case Management** - Track patient cases, diagnoses, and treatments
- **Queue Management** - Manage daily patient queues with token numbers
- **Medicine Management** - Maintain medicine inventory and prescriptions
- **Lab Test Tracking** - Store and manage lab test results
- **Doctor Authentication** - Secure login system for doctors

### Target Users:
- **Doctors/Physicians** - Clinical staff managing patients
- **Clinic Staff** - Reception and administration
- **Group Members** - Collaboration on shared patient data

### Key Business Goals:
✅ Digitize clinic operations
✅ Reduce paperwork and manual errors
✅ Improve patient care quality
✅ Enable data-driven decisions
✅ Secure patient information

---

## 🛠️ Tech Stack Breakdown

### **Frontend (Client-Side)**

```
React 19.2.6
├── Framework for building interactive UI
├── Component-based architecture
├── Real-time state management
└── Fast rendering with virtual DOM

Vite 8.0.14
├── Lightning-fast build tool
├── Hot Module Replacement (HMR)
├── Optimized development experience
└── Production-ready bundling

React Router DOM 7.16.0
├── Client-side routing
├── Multi-page navigation
├── Deep linking support
└── Protected routes

TailwindCSS 4.3.0
├── Utility-first CSS framework
├── Custom styling
├── Responsive design
└── Pre-built components

Framer Motion 12.40.0
├── Smooth animations
├── Page transitions
├── Interactive UI elements
└── Professional effects

Lucide React 1.17.0
├── Beautiful SVG icons
├── Lightweight icon library
├── 1000+ icons
└── Customizable colors

Axios
├── HTTP client library
├── API request handling
├── Interceptors for auth
└── Error handling
```

### **Backend (Server-Side)**

```
Node.js + Express 4.x
├── JavaScript runtime for backend
├── Fast, unopinionated web framework
├── Middleware support
├── RESTful API development
└── Production-ready

Express 4.x
├── Web server framework
├── Routing system
├── Middleware pipeline
├── CORS support
└── Error handling

MySQL2/Promise 3.x
├── MySQL database driver
├── Promise-based API
├── Connection pooling
├── Query optimization
└── Error handling

JWT (jsonwebtoken)
├── Token-based authentication
├── Stateless sessions
├── Secure claims
└── Expiration support

Bcryptjs 3.0.3
├── Password hashing library
├── One-way encryption
├── Salt rounds (10)
└── Comparison verification

Dotenv
├── Environment variable management
├── Configuration separation
├── Development vs production
└── Sensitive data protection

Cors
├── Cross-Origin Resource Sharing
├── Frontend-backend communication
├── Origin whitelist
└── Credential support

Nodemon
├── Development server auto-restart
├── Watch file changes
├── Instant feedback
└── Development efficiency

Concurrently
├── Run multiple processes
├── Frontend + Backend together
├── Single command start
└── Simplified development
```

### **Database**

```
MySQL 8.0+
├── Relational database
├── ACID compliance
├── Complex queries
├── Data integrity
├── Indexing & optimization
└── Enterprise-grade reliability

Features:
├── 10 normalized tables
├── Foreign key relationships
├── Indexes for performance
├── Stored procedures
├── Transaction support
└── Backup/restore capabilities
```

---

## 🏗️ Architecture

### **High-Level Architecture Diagram**

```
┌─────────────────────────────────────────────────────────────┐
│                        USER BROWSER                          │
│  (React + Vite Frontend - http://localhost:5173)            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTP/HTTPS
                     │ JSON
                     │ JWT Tokens
                     │
┌────────────────────▼────────────────────────────────────────┐
│                  Express.js Backend                          │
│          (Node.js Server - http://localhost:5000)           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Routes & Controllers                                 │  │
│  │ ├── Auth Routes (Login, Register)                   │  │
│  │ ├── Patient Routes (CRUD)                           │  │
│  │ ├── Case Routes (Appointments)                      │  │
│  │ ├── Queue Routes (Daily queue)                      │  │
│  │ └── Medicine Routes (Inventory)                     │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Middleware Layer                                     │  │
│  │ ├── JWT Verification                                │  │
│  │ ├── Error Handling                                  │  │
│  │ └── Request Validation                              │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Database Connection Pool (mysql2/promise)           │  │
│  │ ├── Max 10 concurrent connections                   │  │
│  │ ├── Connection reuse                                │  │
│  │ └── Query queue management                          │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ SQL Queries
                     │ Connection Pool
                     │
┌────────────────────▼────────────────────────────────────────┐
│                    MySQL Database                            │
│           (ayurkaya_clinic_db - Port 3306)                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 10 Tables with Relationships                         │  │
│  │ ├── doctors                    (Authentication)      │  │
│  │ ├── patients_registry          (Patient Master)      │  │
│  │ ├── cases                      (Appointments)        │  │
│  │ ├── queue                      (Daily Queue)         │  │
│  │ ├── medicines                  (Inventory)           │  │
│  │ ├── case_medicines             (Prescriptions)       │  │
│  │ ├── lab_tests                  (Test Results)        │  │
│  │ ├── chief_complaints           (Symptoms)            │  │
│  │ ├── audit_logs                 (Activity Log)        │  │
│  │ └── notifications              (Patient Alerts)      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### **Component Hierarchy**

```
App (Root)
├── Login Page
│   ├── Email Input
│   ├── Password Input
│   └── Forgot Password Flow
├── Dashboard (Protected Route)
│   ├── Navbar
│   ├── Main Content
│   │   ├── Patient Registry
│   │   │   ├── Patient List
│   │   │   ├── Add Patient Form
│   │   │   └── Patient Details
│   │   ├── Case Management
│   │   │   ├── Case List
│   │   │   ├── Case Form
│   │   │   ├── Ayurvedic Assessment
│   │   │   └── Lab Tests
│   │   └── Queue Management
│   │       ├── Daily Queue
│   │       ├── Add to Queue
│   │       └── Token System
│   └── Footer
└── Home Page
    ├── Hero Section
    ├── Doctor Cards
    └── Features
```

---

## 📊 Database Schema Explanation

### **Table 1: doctors**
**Purpose**: Store doctor/staff credentials and info

```sql
CREATE TABLE doctors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,        -- Bcrypt hashed
    name VARCHAR(255) NOT NULL,
    passcode VARCHAR(10) NOT NULL,          -- OTP/Passcode
    role VARCHAR(100),                      -- Doctor, Admin, etc.
    qualifications VARCHAR(500),            -- BAMS, MD, etc.
    experience VARCHAR(255),                -- Years of experience
    specializations JSON,                   -- Multiple specializations
    image VARCHAR(500),                     -- Profile image URL
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

Indexes:
- PRIMARY KEY: id
- UNIQUE: email (for login)
```

### **Table 2: patients_registry**
**Purpose**: Master patient information

```sql
CREATE TABLE patients_registry (
    patientId VARCHAR(50) PRIMARY KEY,      -- Unique ID
    logical_id INT UNIQUE AUTO_INCREMENT,   -- Auto-incremented ID
    name VARCHAR(255) NOT NULL,
    age INT,
    gender ENUM('Male', 'Female', 'Other'),
    mobile VARCHAR(20),
    occupation VARCHAR(100),
    email VARCHAR(255),
    address TEXT,
    created_date TIMESTAMP,
    updated_date TIMESTAMP,
    status VARCHAR(50) DEFAULT 'Active'     -- Active/Inactive/Archived
);

Indexes:
- PRIMARY KEY: patientId
- UNIQUE: logical_id (auto-incrementing)
- INDEX: name (for search)
- INDEX: mobile (for phone lookup)
```

### **Table 3: cases**
**Purpose**: Patient appointments and case history

```sql
CREATE TABLE cases (
    caseId VARCHAR(50) PRIMARY KEY,
    patientId VARCHAR(50) NOT NULL,         -- FK to patients
    doctor_id INT,                          -- FK to doctors
    case_date TIMESTAMP,
    chief_complaints JSON,                  -- Stored as JSON array
    
    -- Ayurvedic Assessment (3 Doshas + more)
    kshudha VARCHAR(50),       -- Appetite (Sama/Increased/Decreased)
    mutra VARCHAR(50),         -- Urination (Normal/Increased/Decreased)
    mala VARCHAR(50),          -- Bowel (Normal/Constipated/Loose)
    koshtha VARCHAR(50),       -- Constitution (Krura/Madhya/Mrudu)
    nidra VARCHAR(50),         -- Sleep (Normal/Increased/Decreased)
    avastha VARCHAR(50),       -- State (Niraama/Saama)
    
    -- Medical History
    past_history JSON,         -- Previous illnesses
    drug_history JSON,         -- Previous medications
    family_history JSON,       -- Family medical history
    addiction VARCHAR(100),    -- Smoking, alcohol, etc.
    
    -- Physical Examination
    examination_notes TEXT,
    blood_pressure VARCHAR(20),
    heart_rate INT,
    temperature DECIMAL(5,2),
    
    -- Lab Tests & Diagnosis
    lab_tests JSON,
    diagnosis TEXT,
    treatment_plan TEXT,
    follow_up_date DATE,
    
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    
    FOREIGN KEY (patientId) REFERENCES patients_registry(patientId),
    FOREIGN KEY (doctor_id) REFERENCES doctors(id)
);

Indexes:
- PRIMARY KEY: caseId
- FOREIGN KEY: patientId (for patient lookup)
- FOREIGN KEY: doctor_id (for doctor attribution)
- INDEX: case_date (for historical queries)
```

### **Table 4: queue**
**Purpose**: Daily patient queue management

```sql
CREATE TABLE queue (
    id INT PRIMARY KEY AUTO_INCREMENT,
    patientId VARCHAR(50) NOT NULL,
    doctor_id INT,
    queue_time TIMESTAMP,
    token_number INT,           -- Sequential token (1, 2, 3, ...)
    status ENUM('Waiting', 'In-Progress', 'Completed', 'Cancelled'),
    appointment_date DATE,
    appointment_time TIME,
    consultation_notes TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    
    FOREIGN KEY (patientId) REFERENCES patients_registry,
    FOREIGN KEY (doctor_id) REFERENCES doctors,
    INDEX: status (for filtering),
    INDEX: appointment_date (for daily queries)
);

Key Feature:
- Token system for managing queue
- Tracks appointment status
- Time-stamped for analytics
```

### **Table 5: medicines**
**Purpose**: Medicine/inventory master

```sql
CREATE TABLE medicines (
    id INT PRIMARY KEY AUTO_INCREMENT,
    medicine_name VARCHAR(255) UNIQUE,
    medicine_type VARCHAR(100),             -- Herbal, Powder, Tablet, Liquid
    category VARCHAR(100),                  -- Digestive, Pain Relief, etc.
    dosage_form VARCHAR(50),                -- Powder, Tablet, Liquid, Oil
    unit_quantity INT,                      -- Package size
    unit_type VARCHAR(50),                  -- gm, ml, pcs, etc.
    price DECIMAL(10,2),
    stock_quantity INT DEFAULT 0,           -- Current stock
    description TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

Preset Medicines:
- Triphala Churna (Digestive)
- Chandraprabha Vati (Urinary)
- Ashwagandhadi Churna (Immunity)
- Gandharvahastadi Kashayam (Pain)
```

### **Table 6: case_medicines**
**Purpose**: Prescriptions (Link cases to medicines)

```sql
CREATE TABLE case_medicines (
    id INT PRIMARY KEY AUTO_INCREMENT,
    caseId VARCHAR(50),                     -- FK to cases
    medicine_id INT,                        -- FK to medicines
    dosage VARCHAR(100),                    -- e.g., "1 teaspoon"
    frequency VARCHAR(100),                 -- e.g., "Twice daily"
    duration VARCHAR(100),                  -- e.g., "7 days"
    instructions TEXT,                      -- Special instructions
    created_at TIMESTAMP,
    
    FOREIGN KEY (caseId) REFERENCES cases,
    FOREIGN KEY (medicine_id) REFERENCES medicines
);
```

### **Table 7: lab_tests**
**Purpose**: Lab test results and values

```sql
CREATE TABLE lab_tests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    caseId VARCHAR(50),
    patientId VARCHAR(50),
    test_date TIMESTAMP,
    test_panel VARCHAR(100),                -- Glycemic, Lipid, LFT, KFT
    test_name VARCHAR(255),                 -- FBS, Total Cholesterol, etc.
    result_value DECIMAL(10,2),             -- Actual test result
    reference_range VARCHAR(50),            -- e.g., "70-100"
    unit VARCHAR(50),                       -- mg/dL, %, U/L, etc.
    abnormal_flag BOOLEAN,                  -- True if outside range
    lab_name VARCHAR(255),                  -- Lab name
    created_at TIMESTAMP,
    
    FOREIGN KEY (caseId) REFERENCES cases,
    FOREIGN KEY (patientId) REFERENCES patients_registry
);

Lab Panels:
- Glycemic (FBS, PPBS, HbA1c)
- Lipid (Cholesterol, Triglycerides, HDL, LDL)
- LFT (SGOT, SGPT, Bilirubin, ALP)
- KFT (Creatinine, BUN, Uric Acid)
```

### **Table 8: chief_complaints**
**Purpose**: Patient symptoms/complaints

```sql
CREATE TABLE chief_complaints (
    id INT PRIMARY KEY AUTO_INCREMENT,
    caseId VARCHAR(50),
    complaint_text VARCHAR(500),            -- Description
    onset_date DATE,                        -- When it started
    duration_days INT,                      -- How long
    severity VARCHAR(50),                   -- Mild, Moderate, Severe
    created_at TIMESTAMP,
    
    FOREIGN KEY (caseId) REFERENCES cases
);
```

### **Table 9: audit_logs**
**Purpose**: Activity tracking and compliance

```sql
CREATE TABLE audit_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    doctor_id INT,
    action VARCHAR(255),                    -- INSERT, UPDATE, DELETE
    table_name VARCHAR(100),                -- Which table modified
    record_id VARCHAR(50),                  -- Record modified
    changes JSON,                           -- What changed
    ip_address VARCHAR(45),                 -- Doctor's IP
    timestamp TIMESTAMP,
    
    FOREIGN KEY (doctor_id) REFERENCES doctors
);

Purpose:
- Track all data changes
- Compliance with regulations
- Who did what and when
```

### **Table 10: notifications**
**Purpose**: Patient alerts and messages

```sql
CREATE TABLE notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    patientId VARCHAR(50),
    notification_type VARCHAR(100),         -- Appointment, Lab Result, etc.
    title VARCHAR(255),
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP,
    read_at TIMESTAMP,
    
    FOREIGN KEY (patientId) REFERENCES patients_registry
);
```

### **Database Relationships**

```
doctors (1) ──────→ (Many) cases
doctors (1) ──────→ (Many) queue

patients_registry (1) ──────→ (Many) cases
patients_registry (1) ──────→ (Many) queue
patients_registry (1) ──────→ (Many) lab_tests
patients_registry (1) ──────→ (Many) notifications

cases (1) ──────→ (Many) case_medicines
cases (1) ──────→ (Many) lab_tests
cases (1) ──────→ (Many) chief_complaints

medicines (1) ──────→ (Many) case_medicines
```

---

## 🖥️ Backend System

### **Backend Structure**

```
server/
├── config/
│   └── database.js
│       └── MySQL connection pool setup
│           ├── Environment variables from .env
│           ├── Connection pooling (max 10)
│           └── Error handling
│
├── controllers/
│   ├── authController.js
│   │   ├── login() - Authenticate doctor
│   │   └── register() - Create new doctor
│   └── [other controllers for CRUD operations]
│
├── middleware/
│   └── auth.js
│       ├── verifyToken() - JWT validation
│       └── optionalAuth() - Optional token check
│
├── routes/
│   ├── authRoutes.js
│   │   ├── POST /api/auth/login
│   │   └── POST /api/auth/register
│   │
│   ├── patientRoutes.js
│   │   ├── GET /api/patients
│   │   ├── POST /api/patients
│   │   ├── PUT /api/patients/:id
│   │   └── DELETE /api/patients/:id
│   │
│   ├── caseRoutes.js
│   │   ├── GET /api/cases
│   │   ├── POST /api/cases
│   │   ├── PUT /api/cases/:id
│   │   └── DELETE /api/cases/:id
│   │
│   └── queueRoutes.js
│       ├── GET /api/queue
│       ├── POST /api/queue
│       ├── PUT /api/queue/:id
│       └── DELETE /api/queue/:id
│
├── .env
│   └── Configuration variables (passwords, keys, etc.)
│
└── index.js
    └── Main server file
        ├── Express app setup
        ├── Middleware configuration
        ├── Route registration
        ├── Error handling
        └── Server startup
```

### **Request-Response Flow**

```
1. CLIENT REQUEST
   ├── Browser sends HTTP request
   ├── URL: http://localhost:5000/api/patients
   ├── Method: GET, POST, PUT, DELETE
   ├── Headers: Authorization: Bearer <JWT_TOKEN>
   └── Body: JSON data (for POST/PUT)

2. CORS CHECK (middleware)
   └── Verify origin is whitelisted

3. JWT VERIFICATION (middleware)
   ├── Extract token from header
   ├── Verify signature with secret
   ├── Check expiration
   └── Extract doctor_id and attach to request

4. ROUTE HANDLING
   ├── Match URL to route
   ├── Call controller function
   └── Pass request and response objects

5. BUSINESS LOGIC (Controller)
   ├── Validate input data
   ├── Build SQL query
   └── Execute query via connection pool

6. DATABASE OPERATION
   ├── Get connection from pool
   ├── Execute prepared statement
   ├── Handle results
   └── Return connection to pool

7. RESPONSE CREATION
   ├── Format response JSON
   ├── Set status code (200, 201, 400, 401, 500)
   └── Send response

8. CLIENT RECEIVES
   ├── Response status
   ├── Response data
   └── Display in UI
```

### **Authentication Flow**

```
LOGIN PROCESS:
1. User enters email & password
2. Frontend sends: POST /api/auth/login
3. Backend receives credentials
4. Query: SELECT * FROM doctors WHERE email = ?
5. Compare: bcrypt.compare(inputPassword, hashedPassword)
6. If match:
   ├── Create JWT: sign({doctor_id, email}, SECRET, {expire: 7d})
   ├── Return: {token, doctor{id, name, email, role}}
   └── Frontend stores: localStorage.setItem('auth_token', token)
7. If no match:
   └── Return: 401 Unauthorized

SUBSEQUENT REQUESTS:
1. Frontend reads token from localStorage
2. Adds to header: Authorization: Bearer <token>
3. Backend middleware verifies token
4. If valid: Extract doctor_id and proceed
5. If invalid: Return 401, clear localStorage
6. Frontend redirects to login
```

### **Error Handling**

```
Error Types & Responses:

400 Bad Request
└── Invalid input data
    └── Missing required fields
    └── Invalid data format

401 Unauthorized
└── Authentication failed
    └── No token provided
    └── Invalid token
    └── Expired token
    └── Wrong credentials

404 Not Found
└── Resource doesn't exist
    └── Patient not found
    └── Case not found

500 Internal Server Error
└── Database error
    └── Connection failed
    └── Query error
    └── Server crash

All errors logged to console for debugging
```

---

## 🎨 Frontend System

### **Frontend Architecture**

```
src/
├── pages/
│   ├── Home.jsx
│   │   └── Landing page with hero and doctor cards
│   ├── Login.jsx
│   │   ├── Doctor login form
│   │   ├── Email/password inputs
│   │   └── Forgot password flow
│   └── DbmsDashboard.jsx
│       ├── Main application interface
│       ├── Patient registry
│       ├── Case management
│       └── Queue management
│
├── components/
│   ├── Navbar.jsx
│   │   ├── Navigation links
│   │   ├── Doctor info
│   │   └── Logout button
│   ├── Hero.jsx
│   │   └── Landing page hero section
│   ├── DoctorCard.jsx
│   │   └── Doctor profile display
│   ├── Footer.jsx
│   │   └── Footer information
│   ├── SEO.jsx
│   │   └── Meta tags for pages
│   └── ui/
│       └── Reusable UI components
│
├── services/
│   └── api.js
│       ├── Axios instance
│       ├── All API endpoints
│       ├── Token management
│       └── Request/response interceptors
│
├── lib/
│   ├── db.js
│   │   └── IndexedDB operations (browser storage)
│   └── utils.js
│       └── Helper functions
│
├── App.jsx
│   └── Root component with routing
│
├── main.jsx
│   └── React entry point
│
└── assets/
    └── Images and static files
```

### **Frontend State Management**

```
Local Storage (Browser):
├── auth_token          - JWT token for API calls
├── doctor_info         - Logged-in doctor details
├── ayurkaya_clinic_db  - IndexedDB database

IndexedDB (Browser Database):
├── registry            - Offline patient data
├── cases               - Offline case data
├── queue               - Offline queue data
└── [Other offline data]

Component State (React):
├── Form inputs         - User typed data
├── Loading states      - API call indicators
├── UI state            - Modal open/close, tabs, etc.
└── Error messages      - Validation and API errors
```

### **Component Lifecycle**

```
LOGIN FLOW:
1. User navigates to /login
2. LoginComponent renders
3. User enters email and password
4. Form submit calls: authAPI.login(email, password)
5. Axios sends: POST /api/auth/login
6. Backend validates credentials
7. If success:
   ├── Response contains token
   ├── localStorage.setItem('auth_token', token)
   ├── localStorage.setItem('doctor_info', doctor)
   ├── Navigate to /dashboard
   └── Load dashboard data
8. If failure:
   ├── Show error message
   └── Stay on login page

DASHBOARD FLOW:
1. User logged in, navigates to /dashboard
2. Check token exists (protected route)
3. DashboardComponent renders
4. useEffect triggers on mount
5. Fetch all patients: GET /api/patients
6. Display patient list
7. User clicks "Add Patient"
8. Form opens (modal)
9. User fills form and submits
10. POST /api/patients with form data
11. Backend creates patient in database
12. Response triggers data refresh
13. New patient appears in list

CASE MANAGEMENT FLOW:
1. User selects a patient
2. View patient details
3. Click "Add Case" button
4. Case form opens with fields:
   ├── Chief complaints
   ├── Ayurvedic assessment (Kshudha, Mutra, etc.)
   ├── Medical history
   ├── Physical examination
   ├── Lab tests
   ├── Diagnosis
   ├── Treatment plan
   └── Medicines
5. User fills comprehensive form
6. Click "Save Case"
7. POST /api/cases with all data
8. Backend stores case with relationships
9. Display success message
10. Case appears in case history
```

---

## 🔌 API Documentation

### **Authentication Endpoints**

```
1. LOGIN
   Method: POST
   URL: /api/auth/login
   Body: {
     "email": "drneha@ayurkaya.com",
     "password": "DrNehaAyurkaya1@"
   }
   Response (200 OK): {
     "success": true,
     "token": "eyJhbGciOiJIUzI1NiIs...",
     "doctor": {
       "id": 1,
       "name": "Dr. Neha",
       "email": "drneha@ayurkaya.com",
       "role": "Doctor"
     }
   }
   Errors:
   - 400: Email or password missing
   - 401: Invalid credentials
   - 500: Server error

2. REGISTER
   Method: POST
   URL: /api/auth/register
   Body: {
     "email": "newdoctor@clinic.com",
     "password": "SecurePass123!",
     "name": "Dr. New",
     "passcode": "1234",
     "qualifications": "BAMS, MD"
   }
   Response (201 Created): {
     "success": true,
     "message": "Doctor registered successfully"
   }
   Errors:
   - 400: Doctor already exists
   - 500: Server error
```

### **Patient Endpoints**

```
1. GET ALL PATIENTS
   Method: GET
   URL: /api/patients
   Header: Authorization: Bearer <token>
   Response (200): [{
     "patientId": "PAT001",
     "logical_id": 1,
     "name": "John Doe",
     "age": 35,
     "gender": "Male",
     "mobile": "9876543210",
     "created_date": "2026-06-19T10:00:00Z"
   }, ...]

2. GET PATIENT BY ID
   Method: GET
   URL: /api/patients/PAT001
   Header: Authorization: Bearer <token>
   Response (200): {
     "patient": { ... patient details ... },
     "cases": [{ ... case history ... }]
   }

3. CREATE PATIENT
   Method: POST
   URL: /api/patients
   Header: Authorization: Bearer <token>
   Body: {
     "patientId": "PAT002",
     "name": "Jane Smith",
     "age": 28,
     "gender": "Female",
     "mobile": "9876543211",
     "occupation": "Engineer",
     "email": "jane@email.com",
     "address": "123 Main St"
   }
   Response (201): {
     "success": true,
     "patientId": "PAT002"
   }

4. UPDATE PATIENT
   Method: PUT
   URL: /api/patients/PAT001
   Header: Authorization: Bearer <token>
   Body: { ... updated fields ... }
   Response (200): {
     "success": true,
     "message": "Patient updated"
   }

5. DELETE PATIENT
   Method: DELETE
   URL: /api/patients/PAT001
   Header: Authorization: Bearer <token>
   Response (200): {
     "success": true,
     "message": "Patient deleted"
   }
```

### **Case Endpoints**

```
1. GET ALL CASES
   Method: GET
   URL: /api/cases
   Header: Authorization: Bearer <token>
   Response (200): [{
     "caseId": "CASE001",
     "patientId": "PAT001",
     "case_date": "2026-06-19T10:00:00Z",
     "patient_name": "John Doe",
     "doctor_name": "Dr. Neha",
     "diagnosis": "Vata Imbalance",
     "treatment_plan": "..."
   }, ...]

2. CREATE CASE
   Method: POST
   URL: /api/cases
   Header: Authorization: Bearer <token>
   Body: {
     "caseId": "CASE002",
     "patientId": "PAT001",
     "chief_complaints": [
       { "text": "Headache", "onsetDate": "2026-06-15" },
       { "text": "Fatigue", "onsetDate": "2026-06-10" }
     ],
     "kshudha": "Sama",
     "mutra": "Normal",
     "mala": "Normal",
     "koshtha": "Madhya",
     "nidra": "Normal",
     "avastha": "Niraama",
     "past_history": { ... },
     "drug_history": { ... },
     "family_history": { ... },
     "addiction": "None",
     "diagnosis": "Tension headache with Vata imbalance",
     "treatment_plan": "..."
   }
   Response (201): {
     "success": true,
     "caseId": "CASE002"
   }

3. ADD MEDICINE TO CASE
   Method: POST
   URL: /api/cases/CASE001/medicines
   Header: Authorization: Bearer <token>
   Body: {
     "medicine_id": 1,
     "dosage": "1 teaspoon",
     "frequency": "Twice daily",
     "duration": "7 days",
     "instructions": "Take with warm water"
   }
   Response (201): {
     "success": true,
     "message": "Medicine added"
   }

4. ADD LAB TEST TO CASE
   Method: POST
   URL: /api/cases/CASE001/lab-tests
   Header: Authorization: Bearer <token>
   Body: {
     "patientId": "PAT001",
     "test_panel": "Glycemic",
     "test_name": "Fasting Blood Sugar",
     "result_value": 95,
     "reference_range": "70-100",
     "unit": "mg/dL"
   }
   Response (201): {
     "success": true,
     "message": "Lab test added"
   }
```

### **Queue Endpoints**

```
1. GET QUEUE (Today's queue)
   Method: GET
   URL: /api/queue
   Header: Authorization: Bearer <token>
   Optional Params: ?date=2026-06-19
   Response (200): [{
     "id": 1,
     "token_number": 1,
     "patientId": "PAT001",
     "patient_name": "John Doe",
     "doctor_name": "Dr. Neha",
     "status": "Waiting",
     "appointment_time": "10:30"
   }, ...]

2. ADD TO QUEUE
   Method: POST
   URL: /api/queue
   Header: Authorization: Bearer <token>
   Body: {
     "patientId": "PAT001",
     "appointment_date": "2026-06-19",
     "appointment_time": "10:30"
   }
   Response (201): {
     "success": true,
     "message": "Patient added to queue",
     "token_number": 1
   }

3. UPDATE QUEUE STATUS
   Method: PUT
   URL: /api/queue/1
   Header: Authorization: Bearer <token>
   Body: {
     "status": "In-Progress",
     "consultation_notes": "Patient examined..."
   }
   Response (200): {
     "success": true,
     "message": "Queue status updated"
   }

4. CANCEL QUEUE
   Method: DELETE
   URL: /api/queue/1
   Header: Authorization: Bearer <token>
   Response (200): {
     "success": true,
     "message": "Queue entry cancelled"
   }
```

### **Health Check**

```
Endpoint: GET /api/health
No authentication required
Response (200): {
  "status": "Server is running ✅",
  "timestamp": "2026-06-19T10:00:00.000Z"
}
```

---

## ✨ Features & Functionalities

### **Core Features**

#### 1. **Doctor Authentication**
- ✅ Secure login with email & password
- ✅ Bcrypt password hashing (10 salt rounds)
- ✅ JWT token-based authentication
- ✅ 7-day token expiration
- ✅ Password validation
- ✅ Doctor registration
- ✅ Passcode for additional security

#### 2. **Patient Management**
- ✅ Register new patients
- ✅ Maintain patient master data
- ✅ Update patient information
- ✅ View patient history
- ✅ Search patients (by name, mobile)
- ✅ Delete patient records
- ✅ Auto-incremented logical IDs
- ✅ Status tracking (Active/Inactive/Archived)

#### 3. **Case/Appointment Management**
- ✅ Create comprehensive case records
- ✅ Record chief complaints with onset dates
- ✅ Ayurvedic assessment (Kshudha, Mutra, Mala, etc.)
- ✅ Medical & family history tracking
- ✅ Physical examination notes
- ✅ Add diagnoses
- ✅ Plan treatments
- ✅ Schedule follow-ups
- ✅ Link cases to medicines
- ✅ Track lab test results

#### 4. **Queue Management**
- ✅ Daily patient queue
- ✅ Automatic token number assignment
- ✅ Queue status tracking (Waiting/In-Progress/Completed/Cancelled)
- ✅ Appointment scheduling
- ✅ Consultation notes
- ✅ Real-time queue view
- ✅ Filter by date
- ✅ Cancel appointments

#### 5. **Medicine Management**
- ✅ Maintain medicine inventory
- ✅ Categorize medicines (Herbal, Powder, Tablet, Liquid)
- ✅ Track stock levels
- ✅ Preset Ayurvedic medicines
- ✅ Dosage information
- ✅ Price tracking
- ✅ Medicine descriptions

#### 6. **Lab Test Management**
- ✅ Store lab test results
- ✅ Multiple test panels:
   - Glycemic (FBS, PPBS, HbA1c)
   - Lipid (Cholesterol, Triglycerides, HDL, LDL)
   - LFT (SGOT, SGPT, Bilirubin, ALP)
   - KFT (Creatinine, BUN, Uric Acid)
- ✅ Reference range tracking
- ✅ Abnormal value flagging
- ✅ Lab name recording

#### 7. **Ayurvedic Assessment**
- ✅ Kshudha (Appetite) - Sama/Increased/Decreased
- ✅ Mutra (Urination) - Normal/Increased/Decreased
- ✅ Mala (Bowel) - Normal/Constipated/Loose
- ✅ Koshtha (Constitution) - Krura/Madhya/Mrudu
- ✅ Nidra (Sleep) - Normal/Increased/Decreased
- ✅ Avastha (State) - Niraama/Saama
- ✅ Detailed assessment forms

#### 8. **Data Persistence**
- ✅ MySQL database for primary storage
- ✅ IndexedDB for browser offline access
- ✅ Data synchronization between storage
- ✅ Automatic backup capability

#### 9. **UI/UX Features**
- ✅ Responsive design (Mobile, Tablet, Desktop)
- ✅ Dark/Light mode capability
- ✅ Smooth animations (Framer Motion)
- ✅ Beautiful icons (Lucide React)
- ✅ Tailwind CSS styling
- ✅ Professional UI components
- ✅ Loading states
- ✅ Error notifications
- ✅ Success messages

#### 10. **Security Features**
- ✅ JWT authentication
- ✅ Bcrypt password hashing
- ✅ CORS enabled
- ✅ Protected API routes
- ✅ Token expiration
- ✅ SQL injection prevention (prepared statements)
- ✅ Environment variable protection
- ✅ Audit logging

---

## 🔐 Security Implementation

### **Authentication Security**

```
Password Hashing:
├── Algorithm: Bcrypt
├── Salt Rounds: 10
├── Process:
│   ├── User enters password
│   ├── Random salt generated
│   ├── Password + salt → hash (computationally expensive)
│   ├── Hash stored in database (not password)
│   └── Login: Compare new hash with stored hash
└── Why: One-way encryption, cannot be reversed

JWT Tokens:
├── Algorithm: HS256 (HMAC SHA-256)
├── Structure: Header.Payload.Signature
├── Payload contains:
│   ├── doctor_id
│   ├── email
│   ├── iat (issued at)
│   └── exp (expiration)
├── Secret: Only server knows
├── Verification: Server checks signature
└── Expiration: 7 days default
```

### **Database Security**

```
Prepared Statements:
├── Prevent SQL injection
├── Parameterized queries
├── Example:
│   ├── Vulnerable: SELECT * FROM doctors WHERE email = '"+ email +"'
│   └── Secure: SELECT * FROM doctors WHERE email = ?
│   └── Parameters passed separately

Foreign Key Constraints:
├── Prevent orphaned records
├── Maintain referential integrity
├── Cascade delete where appropriate

Connection Pooling:
├── Limit concurrent connections (10 max)
├── Prevent resource exhaustion
├── Automatic cleanup

Indexes:
├── Improve query performance
├── Reduce database load
├── Secure queries complete faster
```

### **API Security**

```
CORS (Cross-Origin Resource Sharing):
├── Whitelist allowed origins
├── Only http://localhost:5173 allowed in dev
├── Prevents unauthorized cross-site requests

Request Validation:
├── Check required fields
├── Validate data types
├── Validate data ranges
├── Sanitize inputs

Response Security:
├── Never expose sensitive data
├── Never return password hashes
├── Only return necessary fields
├── Hide implementation details in errors

Rate Limiting (Future):
├── Limit requests per IP
├── Prevent brute force attacks
├── Protect API from overload
```

### **Environment Security**

```
.env File (Should NOT be committed):
├── DB_PASSWORD - Never in code
├── JWT_SECRET - Never in code
├── API_KEYS - Never in code
├── .gitignore - Prevents accidental commit

.env.example (SHOULD be committed):
├── Shows structure
├── Has placeholder values
├── Helps team setup
├── No real secrets
```

### **Data Privacy**

```
Patient Data Protection:
├── All patient data encrypted in transit (HTTPS in prod)
├── Access controlled via JWT
├── Audit logs track access
├── Only assigned doctor can view

Sensitive Fields:
├── Passwords - Bcrypt hashed
├── Email - Stored as-is (can be encrypted)
├── Medical history - Protected by auth
├── Lab results - Protected by auth

Compliance:
├── HIPAA-ready architecture
├── Audit trail for all changes
├── Secure deletion (cascade delete)
├── Data retention policies (implementable)
```

---

## 📦 Setup & Deployment

### **Development Setup**

```
1. ENVIRONMENT
   ├── Node.js 18+ required
   ├── MySQL 8.0+ required
   ├── Git for version control
   └── VSCode or IDE

2. DATABASE SETUP
   ├── Install MySQL
   ├── Create database: ayurkaya_clinic_db
   ├── Import schema: CLINIC_DATABASE_SCHEMA.sql
   ├── Verify tables created (10 tables)
   └── Test connection

3. BACKEND SETUP
   ├── cd Clinic-DBMS
   ├── npm install (all dependencies)
   ├── Create server/.env with credentials
   ├── npm run server (start backend)
   └── Verify: http://localhost:5000/api/health

4. FRONTEND SETUP
   ├── npm run dev (start Vite)
   ├── Verify: http://localhost:5173
   ├── Frontend connects to backend
   └── Test login functionality

5. COMBINED RUN
   ├── npm run dev:all (starts both)
   ├── Frontend: http://localhost:5173
   ├── Backend: http://localhost:5000
   └── Database: localhost:3306
```

### **Production Deployment**

```
Backend Deployment (Node.js):
├── Build: npm run build (if needed)
├── Environment: Use production .env
├── Server: Use PM2 for process management
├── Reverse Proxy: Nginx/Apache
├── SSL: HTTPS certificates
├── Port: 443 (HTTPS)
├── Database: Remote MySQL server
└── Monitoring: Health checks, logs

Frontend Deployment (React):
├── Build: npm run build
├── Output: dist/ folder
├── Hosting: CDN/Static server
├── Root: /
├── SPA: Client-side routing
├── CORS: Update CORS_ORIGIN
├── Cache: Set cache headers
└── Minification: Automatic via Vite

Database Backup:
├── Automated daily backups
├── Location: Secure storage
├── Retention: 30 days minimum
├── Testing: Regular restore tests
├── Monitoring: Backup success alerts

Monitoring:
├── Application health
├── Database performance
├── Error rates
├── Response times
├── User activity
└── Security incidents
```

### **Performance Optimization**

```
Backend:
├── Connection pooling (max 10)
├── Query optimization (indexes)
├── Caching (Redis future)
├── Compression (gzip)
├── Load balancing (multiple servers)

Frontend:
├── Code splitting
├── Lazy loading routes
├── Image optimization
├── CSS minification
├── JavaScript minification
├── Service workers

Database:
├── Proper indexing
├── Query optimization
├── Connection pooling
├── Query caching
├── Replication (future)
```

---

## 📊 Project Statistics

```
Frontend:
├── React Components: 10+
├── Pages: 3 (Home, Login, Dashboard)
├── Lines of Code: ~2000+
├── CSS Classes: 100+
├── API Calls: 8+

Backend:
├── Routes: 4 modules (Auth, Patient, Case, Queue)
├── Endpoints: 15+
├── Controllers: 1+ (authController)
├── Middleware: 2 (auth, CORS)
├── Lines of Code: ~500+

Database:
├── Tables: 10
├── Relationships: 8 (Foreign Keys)
├── Indexes: 10+
├── Stored Procedures: 2
├── Sample Records: ~5

Documentation:
├── Files: 8 comprehensive guides
├── Lines: 2000+
├── Code Examples: 50+
├── Diagrams: Multiple ASCII diagrams
```

---

## 🎓 Technology Learning Path

**For Team Members Understanding:**

1. **Frontend Developer**
   - Learn React components
   - Understand routing (React Router)
   - Master Tailwind CSS
   - Learn Axios for API calls
   - Understand JWT token handling

2. **Backend Developer**
   - Learn Express.js fundamentals
   - Understand MySQL queries
   - Master JWT authentication
   - Learn middleware patterns
   - Understand database relationships

3. **Database Administrator**
   - Learn MySQL fundamentals
   - Understand normalization
   - Master indexing strategies
   - Learn backup/restore procedures
   - Understand query optimization

4. **DevOps/Deployment**
   - Learn Node.js deployment
   - Understand MySQL setup
   - Master environment variables
   - Learn Docker (optional)
   - Understand monitoring tools

---

## 📞 Support & Documentation

**Available Documentation:**
- `CLINIC_DATABASE_SCHEMA.sql` - Database structure
- `DATABASE_CONNECTION_SETUP.md` - Setup guide (16 steps)
- `QUICK_START.md` - Quick reference
- `BACKEND_SETUP.md` - Backend overview
- `GITHUB_CONTRIBUTION_GUIDE.md` - Git workflow
- `GITHUB_CONTRIBUTION_CHECKLIST.md` - Quick checklist

**Key Team Contacts:**
- Database Issues: DB Admin
- Backend Issues: Backend Developer
- Frontend Issues: Frontend Developer
- Deployment: DevOps/Deployment Engineer

---

## ✅ Conclusion

**Clinic DBMS** is a comprehensive, production-ready clinic management system built with:

- ✅ Modern tech stack (React, Express, MySQL)
- ✅ Secure authentication (JWT + Bcrypt)
- ✅ Well-designed database (10 normalized tables)
- ✅ RESTful API (15+ endpoints)
- ✅ Responsive UI (Mobile, Tablet, Desktop)
- ✅ Complete documentation (8 guides)
- ✅ Team collaboration ready (Git workflow)

**Ready for:**
- Team development
- Production deployment
- Feature expansion
- Scaling to multiple clinics
- Integration with other systems

---

**Created by**: Team contributors
**Version**: 1.0.0
**Last Updated**: 2026-06-20
**Status**: Development & Testing Phase
