import express from 'express';
import pool from '../config/database.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Get storage metrics
router.get('/archive/metrics', verifyToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    const [patientRows] = await connection.query('SELECT COUNT(*) as count FROM patients_registry');
    const totalPatients = patientRows[0].count;

    const [activeRows] = await connection.query('SELECT COUNT(*) as count FROM cases WHERE case_date >= DATE_SUB(NOW(), INTERVAL 6 MONTH)');
    const activeVisits = activeRows[0].count;

    const [warmRows] = await connection.query('SELECT COUNT(*) as count FROM cases WHERE case_date < DATE_SUB(NOW(), INTERVAL 6 MONTH) AND case_date >= DATE_SUB(NOW(), INTERVAL 1 YEAR)');
    const warmVisits = warmRows[0].count;

    const [archivedRows] = await connection.query('SELECT COUNT(*) as count FROM archived_records');
    const archivedVisits = archivedRows[0].count;

    connection.release();
    
    res.json({
      totalPatients,
      activeVisits,
      warmVisits,
      archivedVisits
    });
  } catch (error) {
    console.error('Error fetching archive metrics:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Run archival sweep (move cases > 1 year to archived_records)
router.post('/archive/sweep', verifyToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    // Find visits older than 1 year
    const [oldCases] = await connection.query(
      'SELECT * FROM cases WHERE case_date < DATE_SUB(NOW(), INTERVAL 1 YEAR)'
    );

    let archivedCount = 0;
    for (const oldCase of oldCases) {
      // Serialize row to JSON
      const jsonData = JSON.stringify(oldCase);
      
      // Insert into archived_records
      await connection.query(
        'INSERT INTO archived_records (original_table, original_id, patient_id, data, archived_reason) VALUES (?, ?, ?, ?, ?)',
        ['cases', oldCase.caseId, oldCase.patientId, jsonData, '1-year retention policy']
      );

      // Delete from active cases
      await connection.query('DELETE FROM cases WHERE caseId = ?', [oldCase.caseId]);
      archivedCount++;
    }

    await connection.commit();
    connection.release();
    
    res.json({ success: true, archivedCount });
  } catch (error) {
    console.error('Error running archival sweep:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Restore an archived record
router.post('/archive/restore/:archiveId', verifyToken, async (req, res) => {
  try {
    const { archiveId } = req.params;
    const connection = await pool.getConnection();
    
    // Get the archive record
    const [archives] = await connection.query('SELECT * FROM archived_records WHERE archive_id = ?', [archiveId]);
    if (archives.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Archive record not found' });
    }

    const archive = archives[0];
    const data = typeof archive.data === 'string' ? JSON.parse(archive.data) : archive.data;
    
    await connection.beginTransaction();

    if (archive.original_table === 'cases') {
      // Insert back to cases
      await connection.query(
        `INSERT INTO cases (
          caseId, patientId, doctor_id, case_date, chief_complaints, past_history, 
          examination_notes, diagnosis, treatment_plan, kshudha, mutra, mala, 
          koshtha, nidra, avastha, blood_pressure, heart_rate, temperature
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE case_date=VALUES(case_date)`,
        [
          data.caseId, data.patientId, data.doctor_id || null, new Date(data.case_date),
          data.chief_complaints ? JSON.stringify(data.chief_complaints) : null,
          data.past_history ? JSON.stringify(data.past_history) : null,
          data.examination_notes, data.diagnosis, data.treatment_plan,
          data.kshudha, data.mutra, data.mala, data.koshtha, data.nidra, data.avastha,
          data.blood_pressure, data.heart_rate, data.temperature
        ]
      );
    }

    // Delete from archived_records
    await connection.query('DELETE FROM archived_records WHERE archive_id = ?', [archiveId]);
    
    await connection.commit();
    connection.release();
    
    res.json({ success: true, message: 'Record restored successfully' });
  } catch (error) {
    console.error('Error restoring archive:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
