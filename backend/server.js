const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const connectDB = require('./src/config/db');
const { errorHandler } = require('./src/middleware/error.middleware');
const { warmUp } = require('./src/services/faceVerification.service'); // ← add this

// Route imports
const authRoutes = require('./src/routes/auth.routes');
const employeeRoutes = require('./src/routes/employee.routes');
const attendanceRoutes = require('./src/routes/attendance.routes');
const leaveRoutes = require('./src/routes/leave.routes');
const payrollRoutes = require('./src/routes/payroll.routes');
const payslipRoutes = require('./src/routes/payslip.routes');
const branchRoutes = require('./src/routes/branch.routes');
const report = require('./src/routes/report.routes')

const app = express();

// Connect to DB then warm up face-api models
connectDB().then(() => {          // ← change connectDB() to connectDB().then()
  warmUp();
});

// Security & parsing middlewares
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/employees', employeeRoutes);
app.use('/api/v1/attendance', attendanceRoutes);
app.use('/api/v1/leaves', leaveRoutes);
app.use('/api/v1/payroll', payrollRoutes);
app.use('/api/v1/payslips', payslipRoutes);
app.use('/api/v1/branches', branchRoutes);
app.use('/api/v1/reports', report);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));

// Global error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));