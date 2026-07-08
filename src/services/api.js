import axios from 'axios';

// API BASE URL
const API_URL = process.env.VITE_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token if unauthorized
      localStorage.removeItem('auth_token');
      localStorage.removeItem('doctor_info');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// =====================================================
// AUTHENTICATION APIs
// =====================================================
export const authAPI = {
  login: (email, password) => 
    api.post('/auth/login', { email, password }),
  
  register: (data) => 
    api.post('/auth/register', data),
  
  logout: () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('doctor_info');
  }
};

// =====================================================
// PATIENT APIs
// =====================================================
export const patientAPI = {
  // Check duplicate patient
  checkDuplicate: (mobile, dateOfBirth) =>
    api.get('/patients/check-duplicate', { params: { mobile, dateOfBirth } }),

  // Get all patients
  getAll: () => 
    api.get('/patients'),
  
  // Get single patient with cases
  getById: (patientId) => 
    api.get(`/patients/${patientId}`),
  
  // Create new patient
  create: (data) => 
    api.post('/patients', data),
  
  // Update patient
  update: (patientId, data) => 
    api.put(`/patients/${patientId}`, data),
  
  // Delete patient
  delete: (patientId) => 
    api.delete(`/patients/${patientId}`),
  
  // Search patients
  search: (query) => 
    api.get('/patients', { params: { search: query } })
};

// =====================================================
// CASE / APPOINTMENT APIs
// =====================================================
export const caseAPI = {
  // Get all cases
  getAll: () => 
    api.get('/cases'),
  
  // Get single case with medicines and tests
  getById: (caseId) => 
    api.get(`/cases/${caseId}`),
  
  // Create new case
  create: (data) => 
    api.post('/cases', data),
  
  // Update case
  update: (caseId, data) => 
    api.put(`/cases/${caseId}`, data),
  
  // Delete case
  delete: (caseId) => 
    api.delete(`/cases/${caseId}`),
  
  // Add medicine to case
  addMedicine: (caseId, medicineData) => 
    api.post(`/cases/${caseId}/medicines`, medicineData),
  
  // Add lab test to case
  addLabTest: (caseId, testData) => 
    api.post(`/cases/${caseId}/lab-tests`, testData)
};

// =====================================================
// QUEUE / APPOINTMENT APIs
// =====================================================
export const queueAPI = {
  // Get queue for today or specific date
  getAll: (date = null) => {
    const params = date ? { date } : {};
    return api.get('/queue', { params });
  },
  
  // Get single queue item
  getById: (queueId) => 
    api.get(`/queue/${queueId}`),
  
  // Add patient to queue
  add: (data) => 
    api.post('/queue', data),
  
  // Update queue status (Waiting, In-Progress, Completed, Cancelled)
  updateStatus: (queueId, status, notes = null) => 
    api.put(`/queue/${queueId}`, { status, consultation_notes: notes }),
  
  // Cancel queue entry
  cancel: (queueId) => 
    api.delete(`/queue/${queueId}`),
  
  // Get patient's queue history
  getPatientHistory: (patientId) => 
    api.get(`/queue/patient/${patientId}`)
};

// =====================================================
// MEDICINE APIs
// =====================================================
export const medicineAPI = {
  // Get all medicines
  getAll: () => 
    api.get('/medicines'),
  
  // Get single medicine
  getById: (medicineId) => 
    api.get(`/medicines/${medicineId}`),
  
  // Search medicines
  search: (query) => 
    api.get('/medicines', { params: { search: query } }),
  
  // Create medicine
  create: (data) => 
    api.post('/medicines', data),
  
  // Update medicine
  update: (medicineId, data) => 
    api.put(`/medicines/${medicineId}`, data),
  
  // Delete medicine
  delete: (medicineId) => 
    api.delete(`/medicines/${medicineId}`)
};

// =====================================================
// LAB TEST APIs
// =====================================================
export const labTestAPI = {
  // Get lab tests for a case
  getByCase: (caseId) => 
    api.get(`/lab-tests/case/${caseId}`),
  
  // Get lab tests for a patient
  getByPatient: (patientId) => 
    api.get(`/lab-tests/patient/${patientId}`),
  
  // Create lab test
  create: (data) => 
    api.post('/lab-tests', data),
  
  // Update lab test
  update: (testId, data) => 
    api.put(`/lab-tests/${testId}`, data),
  
  // Delete lab test
  delete: (testId) => 
    api.delete(`/lab-tests/${testId}`)
};

// =====================================================
// HEALTH CHECK
// =====================================================
export const healthAPI = {
  check: () => 
    api.get('/health')
};

// =====================================================
// VISITS APIs
// =====================================================
export const visitAPI = {
  getByPatient: (patientId) => api.get(`/patients/${patientId}/visits`),
  create: (data) => api.post('/visits', data),
  update: (caseId, data) => api.put(`/visits/${caseId}`, data),
};

// =====================================================
// ARCHIVE APIs
// =====================================================
export const archiveAPI = {
  getMetrics: () => api.get('/archive/metrics'),
  runSweep: () => api.post('/archive/sweep'),
  restoreRecord: (archiveId) => api.post(`/archive/restore/${archiveId}`),
};

// =====================================================
// UTILITY FUNCTIONS
// =====================================================
export const apiUtils = {
  // Save token from login response
  saveToken: (token) => {
    localStorage.setItem('auth_token', token);
  },
  
  // Save doctor info
  saveDoctorInfo: (doctor) => {
    localStorage.setItem('doctor_info', JSON.stringify(doctor));
  },
  
  // Get stored token
  getToken: () => {
    return localStorage.getItem('auth_token');
  },
  
  // Get doctor info
  getDoctorInfo: () => {
    const info = localStorage.getItem('doctor_info');
    return info ? JSON.parse(info) : null;
  },
  
  // Check if authenticated
  isAuthenticated: () => {
    return !!localStorage.getItem('auth_token');
  },
  
  // Clear all auth data
  clearAuth: () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('doctor_info');
  }
};

export default api;
