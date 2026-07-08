import express from 'express';
import pool from '../config/database.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Get visits for a patient
router.get('/patients/:patientId/visits', verifyToken, async (req, res) => {
  try {
    const { patientId } = req.params;
    const connection = await pool.getConnection();
    const [visits] = await connection.query(
      'SELECT * FROM cases WHERE patientId = ? ORDER BY case_date DESC',
      [patientId]
    );
    connection.release();
    res.json(visits);
  } catch (error) {
    console.error('Error fetching visits:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a new normalized visit (case)
router.post('/visits', verifyToken, async (req, res) => {
  try {
    const { 
      caseId, patientId, doctor_id, chief_complaints, past_history, 
      examination_notes, diagnosis, treatment_plan, case_date,
      kshudha, mutra, mala, koshtha, nidra, avastha,
      blood_pressure, heart_rate, temperature
    } = req.body;
    
    const connection = await pool.getConnection();

    await connection.query(
      `INSERT INTO cases (
        caseId, patientId, doctor_id, chief_complaints, past_history, 
        examination_notes, diagnosis, treatment_plan, case_date,
        kshudha, mutra, mala, koshtha, nidra, avastha,
        blood_pressure, heart_rate, temperature
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        caseId, patientId, doctor_id || null, 
        chief_complaints ? JSON.stringify(chief_complaints) : null, 
        past_history ? JSON.stringify(past_history) : null, 
        examination_notes, diagnosis, treatment_plan, case_date || new Date(),
        kshudha, mutra, mala, koshtha, nidra, avastha,
        blood_pressure, heart_rate, temperature
      ]
    );

    connection.release();
    res.status(201).json({ success: true, caseId });
  } catch (error) {
    console.error('Error creating visit:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update a visit (case)
router.put('/visits/:caseId', verifyToken, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { 
      chief_complaints, past_history, examination_notes, 
      diagnosis, treatment_plan,
      kshudha, mutra, mala, koshtha, nidra, avastha,
      blood_pressure, heart_rate, temperature
    } = req.body;
    
    const connection = await pool.getConnection();

    await connection.query(
      `UPDATE cases SET 
        chief_complaints=?, past_history=?, examination_notes=?, 
        diagnosis=?, treatment_plan=?,
        kshudha=?, mutra=?, mala=?, koshtha=?, nidra=?, avastha=?,
        blood_pressure=?, heart_rate=?, temperature=?
      WHERE caseId=?`,
      [
        chief_complaints ? JSON.stringify(chief_complaints) : null, 
        past_history ? JSON.stringify(past_history) : null, 
        examination_notes, diagnosis, treatment_plan,
        kshudha, mutra, mala, koshtha, nidra, avastha,
        blood_pressure, heart_rate, temperature,
        caseId
      ]
    );

    connection.release();
    res.json({ success: true, message: 'Visit updated' });
  } catch (error) {
    console.error('Error updating visit:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
