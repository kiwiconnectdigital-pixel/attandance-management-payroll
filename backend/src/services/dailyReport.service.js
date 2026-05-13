const cron = require('node-cron');
const moment = require('moment');
const nodemailer = require('nodemailer');

const Attendance = require('../models/Attendance.model');
const Employee = require('../models/Employee.model');

const {
  generateAttendancePDF,
  generateAttendanceExcel
} = require('./report.service');

const startDailyAttendanceReport = () => {

  // Runs every day at 11:59 PM
  cron.schedule('*/5 * * * *', async () => {
    try {
console.log('Running report job at:', moment().format('hh:mm:ss A'));
      

      const todayStart = moment()
        .tz('Asia/Kolkata')
        .startOf('day')
        .toDate();

      const todayEnd = moment()
        .tz('Asia/Kolkata')
        .endOf('day')
        .toDate();

      // Fetch today attendance
      const attendanceRecords = await Attendance.find({
        date: {
          $gte: todayStart,
          $lte: todayEnd,
        },
      }).populate('employee', 'name employeeCode department');

      const totalEmployees = await Employee.countDocuments({
        isActive: true,
      });

      const presentCount = attendanceRecords.filter(
        a => a.status === 'present'
      ).length;

      const halfDayCount = attendanceRecords.filter(
        a => a.status === 'half-day'
      ).length;

      const lateCount = attendanceRecords.filter(
        a => a.isLate
      ).length;

     const absentCount = Math.max(
  totalEmployees - presentCount - halfDayCount,
  0
);
      // Generate reports
      const month = moment().month() + 1;
      const year = moment().year();

      const pdfBuffer = await generateAttendancePDF({
        month,
        year,
      });

      const excelBuffer = await generateAttendanceExcel({
        month,
        year,
      });

      // Mail transporter
      const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});
await transporter.verify();
console.log('✅ Mail server connected');
      // Send email
      await transporter.sendMail({
        from: process.env.MAIL_USER,
        to: process.env.ADMIN_EMAIL,
        subject: `Daily Attendance Report - ${moment().format('DD MMM YYYY')}`,

        html: `
          <h2>Daily Attendance Summary</h2>

          <p><strong>Date:</strong> ${moment().format('DD MMM YYYY')}</p>

          <table border="1" cellpadding="10" cellspacing="0">
            <tr>
              <th>Total Employees</th>
              <th>Present</th>
              <th>Half Day</th>
              <th>Late</th>
              <th>Absent</th>
            </tr>

            <tr>
              <td>${totalEmployees}</td>
              <td>${presentCount}</td>
              <td>${halfDayCount}</td>
              <td>${lateCount}</td>
              <td>${absentCount}</td>
            </tr>
          </table>

          <br/>

          <p>Please find attached reports.</p>
        `,

        attachments: [
          {
            filename: `attendance_${year}_${month}.pdf`,
            content: pdfBuffer,
          },
          {
            filename: `attendance_${year}_${month}.xlsx`,
            content: excelBuffer,
          },
        ],
      });

      console.log('Daily attendance report email sent.');

    } catch (error) {
      console.error('Daily attendance report failed:', error);
    }
  }, {
    timezone: 'Asia/Kolkata',
  });
};

module.exports = {
  startDailyAttendanceReport,
};