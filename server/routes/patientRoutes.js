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
// Check duplicate patient
router.get('/patients/check-duplicate', verifyToken, async (req, res) => {
  try {
    const { mobile, dateOfBirth } = req.query;
    if (!mobile || !dateOfBirth) {
      return res.status(400).json({ error: 'mobile and dateOfBirth are required' });
    }
    
    const connection = await pool.getConnection();
    const [patients] = await connection.query(
      'SELECT * FROM patients_registry WHERE mobile = ? AND date_of_birth = ? LIMIT 1',
      [mobile, dateOfBirth]
    );
    connection.release();
    
    if (patients.length > 0) {
      res.json({ isDuplicate: true, patient: patients[0] });
    } else {
      res.json({ isDuplicate: false });
    }
  } catch (error) {
    console.error('Error checking duplicate patient:', error);
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
    const { patientId, name, age, date_of_birth, gender, mobile, occupation, email, address } = req.body;
    const connection = await pool.getConnection();

    await connection.query(
      'INSERT INTO patients_registry (patientId, name, age, date_of_birth, gender, mobile, occupation, email, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [patientId, name, age, date_of_birth, gender, mobile, occupation, email, address]
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
    const { name, age, date_of_birth, gender, mobile, occupation, email, address } = req.body;
    const connection = await pool.getConnection();

    await connection.query(
      'UPDATE patients_registry SET name=?, age=?, date_of_birth=?, gender=?, mobile=?, occupation=?, email=?, address=? WHERE patientId=?',
      [name, age, date_of_birth, gender, mobile, occupation, email, address, patientId]
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
