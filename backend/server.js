// server.js - Without Auto-Sync on Startup
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const sequelize = require('./src/config/db');
const { errorHandler } = require('./src/middleware/error.middleware');
const { warmUp } = require('./src/services/faceVerification.service');
const { startDailyAttendanceReport } = require('./src/services/dailyReport.service');

// Routes
const authRoutes = require('./src/routes/auth.routes');
const employeeRoutes = require('./src/routes/employee.routes');
const attendanceRoutes = require('./src/routes/attendance.routes');
const leaveRoutes = require('./src/routes/leave.routes');
const payrollRoutes = require('./src/routes/payroll.routes');
const payslipRoutes = require('./src/routes/payslip.routes');
const branchRoutes = require('./src/routes/branch.routes');
const reportRoutes = require('./src/routes/report.routes');
const holidayRoutes = require('./src/routes/holiday.routes');
const companyRoutes = require('./src/routes/company.routes');
const userRoutes = require('./src/routes/user.routes');


const app = express();

// ✅ Connect to Database WITHOUT auto-sync
(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
    
    // DO NOT sync automatically - let the SQL script handle table creation
    // Only sync if explicitly needed
    if (process.env.SYNC_DB === 'true') {
      await sequelize.sync({ alter: true });
      console.log('✅ Database synchronized.');
    } else {
      console.log('ℹ️ Database sync skipped. Using existing tables.');
    }
    
    // Warm up face verification service
    warmUp();
    
    // Start daily attendance report cron
    startDailyAttendanceReport();
    console.log('📧 Daily attendance report scheduler started');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    // Don't exit - let the server start anyway
  }
})();

// ✅ Allowed Origins
const allowedOrigins = [
  'http://localhost:5173',
  'https://calm-boba-d71ad7.netlify.app',
  process.env.CLIENT_URL
].filter(Boolean);

// ✅ CORS CONFIG
app.use(cors({
  origin: function (origin, callback) {
    console.log("🌐 Request Origin:", origin);

    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error(`❌ Not allowed by CORS: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ✅ HANDLE PREFLIGHT
app.options('*', cors());

// ✅ Middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ✅ Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/employees', employeeRoutes);
app.use('/api/v1/attendance', attendanceRoutes);
app.use('/api/v1/leaves', leaveRoutes);
app.use('/api/v1/payroll', payrollRoutes);
app.use('/api/v1/payslips', payslipRoutes);
app.use('/api/v1/branches', branchRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/holidays', holidayRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/companies', companyRoutes);

// ✅ Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date(),
    database: 'MySQL'
  });
});

// ✅ Error handler
app.use(errorHandler);

// ✅ Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});