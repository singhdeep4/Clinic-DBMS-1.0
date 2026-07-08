import express from 'express';
import pool from '../config/database.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Get queue for a specific date
router.get('/queue', verifyToken, async (req, res) => {
  try {
    const { date } = req.query;
    const connection = await pool.getConnection();

    let query = `SELECT q.*, p.name as patient_name, p.mobile, d.name as doctor_name 
                 FROM queue q 
                 LEFT JOIN patients_registry p ON q.patientId = p.patientId 
                 LEFT JOIN doctors d ON q.doctor_id = d.id`;
    let params = [];

    if (date) {
      query += ' WHERE DATE(q.appointment_date) = ? ORDER BY q.token_number ASC';
      params.push(date);
    } else {
      query += ' WHERE DATE(q.appointment_date) = CURDATE() ORDER BY q.token_number ASC';
    }

    const [queueList] = await connection.query(query, params);
    connection.release();
    res.json(queueList);
  } catch (error) {
    console.error('Error fetching queue:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get queue item by ID
router.get('/queue/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    const [queueItem] = await connection.query(
      `SELECT q.*, p.name as patient_name, p.mobile, p.age, d.name as doctor_name 
       FROM queue q 
       LEFT JOIN patients_registry p ON q.patientId = p.patientId 
       LEFT JOIN doctors d ON q.doctor_id = d.id 
       WHERE q.id = ?`,
      [id]
    );

    connection.release();

    if (queueItem.length === 0) {
      return res.status(404).json({ error: 'Queue item not found' });
    }

    res.json(queueItem[0]);
  } catch (error) {
    console.error('Error fetching queue item:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add patient to queue
router.post('/queue', verifyToken, async (req, res) => {
  try {
    const { patientId, appointment_date, appointment_time } = req.body;
    const connection = await pool.getConnection();

    // Get next token number for the day
    const [result] = await connection.query(
      'SELECT MAX(token_number) as max_token FROM queue WHERE DATE(appointment_date) = ?',
      [appointment_date]
    );

    const nextToken = (result[0]?.max_token || 0) + 1;

    await connection.query(
      `INSERT INTO queue 
       (patientId, doctor_id, appointment_date, appointment_time, token_number, status) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [patientId, req.doctor_id, appointment_date, appointment_time, nextToken, 'Waiting']
    );

    connection.release();
    res.status(201).json({ 
      success: true, 
      message: 'Patient added to queue',
      token_number: nextToken 
    });
  } catch (error) {
    console.error('Error adding to queue:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update queue status
router.put('/queue/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, consultation_notes } = req.body;

    const connection = await pool.getConnection();

    await connection.query(
      'UPDATE queue SET status = ?, consultation_notes = ? WHERE id = ?',
      [status, consultation_notes || null, id]
    );

    connection.release();
    res.json({ success: true, message: 'Queue status updated' });
  } catch (error) {
    console.error('Error updating queue:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Cancel queue entry
router.delete('/queue/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    await connection.query(
      'UPDATE queue SET status = ? WHERE id = ?',
      ['Cancelled', id]
    );

    connection.release();
    res.json({ success: true, message: 'Queue entry cancelled' });
  } catch (error) {
    console.error('Error cancelling queue entry:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get patient queue history
router.get('/queue/patient/:patientId', verifyToken, async (req, res) => {
  try {
    const { patientId } = req.params;
    const connection = await pool.getConnection();

    const [history] = await connection.query(
      `SELECT q.*, d.name as doctor_name 
       FROM queue q 
       LEFT JOIN doctors d ON q.doctor_id = d.id 
       WHERE q.patientId = ? 
       ORDER BY q.queue_time DESC 
       LIMIT 10`,
      [patientId]
    );

    connection.release();
    res.json(history);
  } catch (error) {
    console.error('Error fetching queue history:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
