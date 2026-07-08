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
