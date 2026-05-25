const cron = require('node-cron');
const moment = require('moment-timezone');
const nodemailer = require('nodemailer');

const Attendance = require('../models/Attendance.model');
const Employee = require('../models/Employee.model');

const {
  generateAttendancePDF,
  generateAttendanceExcel
} = require('./report.service');

const startDailyAttendanceReport = () => {

  cron.schedule('0 21 * * *', async () => {
    try {

      console.log(
        'Running report job at:',
        moment().tz('Asia/Kolkata').format('DD MMM YYYY hh:mm:ss A')
      );

      const todayStart = moment()
        .tz('Asia/Kolkata')
        .startOf('day')
        .toDate();

      const todayEnd = moment()
        .tz('Asia/Kolkata')
        .endOf('day')
        .toDate();

      // Fetch attendance with branch population
      const attendanceRecords = await Attendance.find({
        date: {
          $gte: todayStart,
          $lte: todayEnd,
        },
      })
      .populate({
        path: 'employee',
        select: 'name employeeCode department',
      })
      .populate({
        path: 'checkIns.branch',
        select: 'name address',
      })
      .populate({
        path: 'checkOuts.branch',
        select: 'name address',
      });

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

      const month = moment().month() + 1;
      const year = moment().year();

      // Generate reports
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
        subject: `Attendance Report - ${moment()
          .tz('Asia/Kolkata')
          .format('DD MMM YYYY hh:mm A')}`,

        html: `
          <h2>Attendance Summary (Auto Report)</h2>

          <p>
            <strong>Date:</strong>
            ${moment()
              .tz('Asia/Kolkata')
              .format('DD MMM YYYY hh:mm A')}
          </p>

          <p><strong>Total Employees:</strong> ${totalEmployees}</p>
          <p><strong>Present:</strong> ${presentCount}</p>
          <p><strong>Half Day:</strong> ${halfDayCount}</p>
          <p><strong>Late:</strong> ${lateCount}</p>
          <p><strong>Absent:</strong> ${absentCount}</p>

          <br/>

          <table border="1" cellpadding="10" cellspacing="0" style="border-collapse: collapse; width: 100%;">
            
            <tr style="background:#f2f2f2;">
              <th>Employee</th>
              <th>Code</th>
              <th>Login Branch</th>
              <th>Logout Branch</th>
              <th>Status</th>
              <th>Late</th>
              <th>Working Hours</th>
            </tr>

            ${attendanceRecords.map(a => {

              const checkInBranch =
                a.checkIns?.[0]?.branch?.name || '—';

              const checkOutBranch =
                a.checkOuts?.[0]?.branch?.name || '—';

              return `
                <tr>
                  <td>${a.employee?.name || '-'}</td>

                  <td>${a.employee?.employeeCode || '-'}</td>

                  <td>${checkInBranch}</td>

                  <td>${checkOutBranch}</td>

                  <td>${a.status || '-'}</td>

                  <td>${a.isLate ? '✔ Yes' : 'No'}</td>

                  <td>${a.workingHours || 0} hrs</td>
                </tr>
              `;
            }).join('')}

          </table>

          <br/>

          <p>
            <b>Note:</b>
            This is an automated attendance report generated every 2 minutes.
          </p>
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

      console.log('📧 Attendance report email sent successfully');

    } catch (error) {

      console.error(
        '❌ Daily attendance report failed:',
        error
      );

    }

  }, {
    timezone: 'Asia/Kolkata',
  });
};

module.exports = {
  startDailyAttendanceReport,
};