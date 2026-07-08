import express from 'express';
import pool from '../config/database.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Get all cases
router.get('/cases', verifyToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [cases] = await connection.query(
      `SELECT c.*, p.name as patient_name, d.name as doctor_name 
       FROM cases c 
       LEFT JOIN patients_registry p ON c.patientId = p.patientId 
       LEFT JOIN doctors d ON c.doctor_id = d.id 
       ORDER BY c.case_date DESC`
    );
    connection.release();
    res.json(cases);
  } catch (error) {
    console.error('Error fetching cases:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get case by ID
router.get('/cases/:caseId', verifyToken, async (req, res) => {
  try {
    const { caseId } = req.params;
    const connection = await pool.getConnection();
    
    const [cases] = await connection.query(
      'SELECT * FROM cases WHERE caseId = ?',
      [caseId]
    );
    
    if (cases.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Case not found' });
    }

    // Get associated medicines
    const [medicines] = await connection.query(
      `SELECT m.*, cm.dosage, cm.frequency, cm.duration, cm.instructions
       FROM case_medicines cm
       JOIN medicines m ON cm.medicine_id = m.id
       WHERE cm.caseId = ?`,
      [caseId]
    );

    // Get associated lab tests
    const [labTests] = await connection.query(
      'SELECT * FROM lab_tests WHERE caseId = ?',
      [caseId]
    );

    // Get chief complaints
    const [complaints] = await connection.query(
      'SELECT * FROM chief_complaints WHERE caseId = ?',
      [caseId]
    );

    connection.release();
    
    res.json({
      case: cases[0],
      medicines,
      labTests,
      complaints
    });
  } catch (error) {
    console.error('Error fetching case:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create case
router.post('/cases', verifyToken, async (req, res) => {
  try {
    const {
      caseId, patientId, chief_complaints, kshudha, mutra, mala, 
      koshtha, nidra, avastha, past_history, drug_history, family_history,
      addiction, diagnosis, treatment_plan, follow_up_date
    } = req.body;

    const connection = await pool.getConnection();

    // Start transaction
    await connection.query('START TRANSACTION');

    try {
      // Insert case
      await connection.query(
        `INSERT INTO cases 
        (caseId, patientId, doctor_id, chief_complaints, kshudha, mutra, mala, 
         koshtha, nidra, avastha, past_history, drug_history, family_history, 
         addiction, diagnosis, treatment_plan, follow_up_date) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [caseId, patientId, req.doctor_id, JSON.stringify(chief_complaints), 
         kshudha, mutra, mala, koshtha, nidra, avastha, 
         JSON.stringify(past_history), JSON.stringify(drug_history), 
         JSON.stringify(family_history), addiction, diagnosis, treatment_plan, follow_up_date]
      );

      // Insert chief complaints
      if (chief_complaints && Array.isArray(chief_complaints)) {
        for (const complaint of chief_complaints) {
          await connection.query(
            'INSERT INTO chief_complaints (caseId, complaint_text, onset_date) VALUES (?, ?, ?)',
            [caseId, complaint.text, complaint.onsetDate]
          );
        }
      }

      await connection.query('COMMIT');
      connection.release();

      res.status(201).json({ success: true, caseId });
    } catch (error) {
      await connection.query('ROLLBACK');
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Error creating case:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update case
router.put('/cases/:caseId', verifyToken, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { 
      diagnosis, treatment_plan, follow_up_date, 
      kshudha, mutra, mala, koshtha, nidra, avastha 
    } = req.body;

    const connection = await pool.getConnection();

    await connection.query(
      `UPDATE cases SET 
       diagnosis=?, treatment_plan=?, follow_up_date=?, 
       kshudha=?, mutra=?, mala=?, koshtha=?, nidra=?, avastha=? 
       WHERE caseId=?`,
      [diagnosis, treatment_plan, follow_up_date, 
       kshudha, mutra, mala, koshtha, nidra, avastha, caseId]
    );

    connection.release();
    res.json({ success: true, message: 'Case updated' });
  } catch (error) {
    console.error('Error updating case:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete case
router.delete('/cases/:caseId', verifyToken, async (req, res) => {
  try {
    const { caseId } = req.params;
    const connection = await pool.getConnection();

    await connection.query('DELETE FROM cases WHERE caseId = ?', [caseId]);
    connection.release();

    res.json({ success: true, message: 'Case deleted' });
  } catch (error) {
    console.error('Error deleting case:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add medicine to case
router.post('/cases/:caseId/medicines', verifyToken, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { medicine_id, dosage, frequency, duration, instructions } = req.body;

    const connection = await pool.getConnection();

    await connection.query(
      'INSERT INTO case_medicines (caseId, medicine_id, dosage, frequency, duration, instructions) VALUES (?, ?, ?, ?, ?, ?)',
      [caseId, medicine_id, dosage, frequency, duration, instructions]
    );

    connection.release();
    res.status(201).json({ success: true, message: 'Medicine added' });
  } catch (error) {
    console.error('Error adding medicine:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add lab test to case
router.post('/cases/:caseId/lab-tests', verifyToken, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { patientId, test_panel, test_name, result_value, reference_range, unit } = req.body;

    const connection = await pool.getConnection();

    await connection.query(
      `INSERT INTO lab_tests 
       (caseId, patientId, test_panel, test_name, result_value, reference_range, unit) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [caseId, patientId, test_panel, test_name, result_value, reference_range, unit]
    );

    connection.release();
    res.status(201).json({ success: true, message: 'Lab test added' });
  } catch (error) {
    console.error('Error adding lab test:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
