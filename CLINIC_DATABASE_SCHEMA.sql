-- =====================================================
-- AYURKAYA CLINIC MANAGEMENT SYSTEM - DATABASE SCHEMA
-- =====================================================

-- Create Database
CREATE DATABASE IF NOT EXISTS ayurkaya_clinic_db;
USE ayurkaya_clinic_db;

-- =====================================================
-- 1. DOCTORS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS doctors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    passcode VARCHAR(10) NOT NULL,
    role VARCHAR(100) DEFAULT 'Doctor',
    qualifications VARCHAR(500),
    experience VARCHAR(255),
    specializations JSON,
    image VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- =====================================================
-- 2. PATIENTS REGISTRY TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS patients_registry (
    patientId VARCHAR(50) PRIMARY KEY,
    logical_id INT UNIQUE AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    age INT,
    date_of_birth DATE NULL,
    gender ENUM('Male', 'Female', 'Other'),
    mobile VARCHAR(20),
    occupation VARCHAR(100),
    email VARCHAR(255),
    address TEXT,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'Active',
    UNIQUE KEY uq_mobile_dob (mobile, date_of_birth)
);

-- =====================================================
-- 3. PATIENT CASES/APPOINTMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS cases (
    caseId VARCHAR(50) PRIMARY KEY,
    patientId VARCHAR(50) NOT NULL,
    doctor_id INT,
    case_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    chief_complaints JSON,
    
    -- Ayurvedic Assessment
    kshudha VARCHAR(50),
    mutra VARCHAR(50),
    mala VARCHAR(50),
    koshtha VARCHAR(50),
    nidra VARCHAR(50),
    avastha VARCHAR(50),
    
    -- Medical History
    past_history JSON,
    drug_history JSON,
    family_history JSON,
    addiction VARCHAR(100),
    
    -- Physical Examination
    examination_notes TEXT,
    blood_pressure VARCHAR(20),
    heart_rate INT,
    temperature DECIMAL(5,2),
    
    -- Lab Tests
    lab_tests JSON,
    
    -- Medications
    medications JSON,
    
    -- Diagnosis & Treatment
    diagnosis TEXT,
    treatment_plan TEXT,
    follow_up_date DATE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patientId) REFERENCES patients_registry(patientId) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL
);

-- =====================================================
-- 4. PATIENT QUEUE TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS queue (
    id INT PRIMARY KEY AUTO_INCREMENT,
    patientId VARCHAR(50) NOT NULL,
    doctor_id INT,
    queue_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    token_number INT,
    status ENUM('Waiting', 'In-Progress', 'Completed', 'Cancelled') DEFAULT 'Waiting',
    appointment_date DATE,
    appointment_time TIME,
    consultation_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patientId) REFERENCES patients_registry(patientId) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL,
    INDEX idx_status (status),
    INDEX idx_date (appointment_date)
);

-- =====================================================
-- 5. MEDICINES/PRESCRIPTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS medicines (
    id INT PRIMARY KEY AUTO_INCREMENT,
    medicine_name VARCHAR(255) NOT NULL UNIQUE,
    medicine_type VARCHAR(100),
    category VARCHAR(100),
    dosage_form VARCHAR(50),
    unit_quantity INT,
    unit_type VARCHAR(50),
    price DECIMAL(10,2),
    stock_quantity INT DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- =====================================================
-- 6. CASE MEDICINES (Junction Table)
-- =====================================================
CREATE TABLE IF NOT EXISTS case_medicines (
    id INT PRIMARY KEY AUTO_INCREMENT,
    caseId VARCHAR(50) NOT NULL,
    medicine_id INT NOT NULL,
    dosage VARCHAR(100),
    frequency VARCHAR(100),
    duration VARCHAR(100),
    instructions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (caseId) REFERENCES cases(caseId) ON DELETE CASCADE,
    FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE RESTRICT
);

-- =====================================================
-- 7. LAB TESTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS lab_tests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    caseId VARCHAR(50) NOT NULL,
    patientId VARCHAR(50) NOT NULL,
    test_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    test_panel VARCHAR(100),
    test_name VARCHAR(255),
    result_value DECIMAL(10,2),
    reference_range VARCHAR(50),
    unit VARCHAR(50),
    abnormal_flag BOOLEAN DEFAULT FALSE,
    lab_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (caseId) REFERENCES cases(caseId) ON DELETE CASCADE,
    FOREIGN KEY (patientId) REFERENCES patients_registry(patientId) ON DELETE CASCADE
);

-- =====================================================
-- 8. CHIEF COMPLAINTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS chief_complaints (
    id INT PRIMARY KEY AUTO_INCREMENT,
    caseId VARCHAR(50) NOT NULL,
    complaint_text VARCHAR(500),
    onset_date DATE,
    duration_days INT,
    severity VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (caseId) REFERENCES cases(caseId) ON DELETE CASCADE
);

-- =====================================================
-- 9. AUDIT LOG TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    doctor_id INT,
    action VARCHAR(255),
    table_name VARCHAR(100),
    record_id VARCHAR(50),
    changes JSON,
    ip_address VARCHAR(45),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL
);

-- =====================================================
-- 10. PATIENT NOTIFICATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    patientId VARCHAR(50) NOT NULL,
    notification_type VARCHAR(100),
    title VARCHAR(255),
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP NULL,
    FOREIGN KEY (patientId) REFERENCES patients_registry(patientId) ON DELETE CASCADE
);

-- =====================================================
-- 11. ARCHIVED RECORDS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS archived_records (
    archive_id INT AUTO_INCREMENT PRIMARY KEY,
    original_table VARCHAR(50) NOT NULL,
    original_id VARCHAR(50) NOT NULL,
    patient_id VARCHAR(50) NOT NULL,
    data JSON NOT NULL,
    archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    archived_reason VARCHAR(100),
    FOREIGN KEY (patient_id) REFERENCES patients_registry(patientId) ON DELETE CASCADE
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX idx_patient_name ON patients_registry(name);
CREATE INDEX idx_patient_mobile ON patients_registry(mobile);
CREATE INDEX idx_case_patient ON cases(patientId);
CREATE INDEX idx_case_doctor ON cases(doctor_id);
CREATE INDEX idx_case_date ON cases(case_date);
CREATE INDEX idx_queue_patient ON queue(patientId);
CREATE INDEX idx_queue_doctor ON queue(doctor_id);
CREATE INDEX idx_medicine_name ON medicines(medicine_name);
CREATE INDEX idx_lab_case ON lab_tests(caseId);
CREATE INDEX idx_audit_doctor ON audit_logs(doctor_id);

-- =====================================================
-- SAMPLE DATA (Optional)
-- =====================================================

-- Insert Sample Doctor
INSERT INTO doctors (email, password, name, passcode, role, qualifications, experience)
VALUES ('drneha@ayurkaya.com', 'DrNehaAyurkaya1@', 'Dr. Neha', '1008', 'Doctor', 'BAMS, MD Ayurveda', '10 years');

-- Insert Sample Medicines
INSERT INTO medicines (medicine_name, medicine_type, category, dosage_form, unit_quantity, unit_type, stock_quantity)
VALUES 
('Triphala Churna', 'Herbal', 'Digestive', 'Powder', 500, 'gm', 50),
('Chandraprabha Vati', 'Herbal', 'Urinary', 'Tablet', 100, 'pcs', 200),
('Gandharvahastadi Kashayam', 'Herbal', 'Pain Relief', 'Liquid', 450, 'ml', 30),
('Arogyavardhini Vati', 'Herbal', 'Liver Support', 'Tablet', 100, 'pcs', 150),
('Ashwagandhadi Churna', 'Herbal', 'Immunity', 'Powder', 200, 'gm', 40);

-- =====================================================
-- STORED PROCEDURES (Optional - for common operations)
-- =====================================================

DELIMITER $$

-- Get Patient Complete Medical History
CREATE PROCEDURE IF NOT EXISTS GetPatientHistory(IN p_patientId VARCHAR(50))
BEGIN
    SELECT 
        p.patientId,
        p.name,
        p.age,
        p.mobile,
        c.caseId,
        c.case_date,
        c.diagnosis,
        c.treatment_plan
    FROM patients_registry p
    LEFT JOIN cases c ON p.patientId = c.patientId
    WHERE p.patientId = p_patientId
    ORDER BY c.case_date DESC;
END$$

-- Get Queue Status
CREATE PROCEDURE IF NOT EXISTS GetQueueStatus(IN p_date DATE)
BEGIN
    SELECT 
        q.token_number,
        q.status,
        p.name,
        p.mobile,
        d.name as doctor_name,
        q.appointment_time
    FROM queue q
    JOIN patients_registry p ON q.patientId = p.patientId
    LEFT JOIN doctors d ON q.doctor_id = d.id
    WHERE q.appointment_date = p_date
    ORDER BY q.token_number;
END$$

DELIMITER ;
