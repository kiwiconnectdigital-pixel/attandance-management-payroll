import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  AlertCircle,
  X,
} from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isToday,
} from 'date-fns';
import { attendanceAPI, employeeAPI } from '../../services/api';
import toast, { Toaster } from 'react-hot-toast';

const EmployeeAttendanceCalendar = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [attendanceData, setAttendanceData] = useState({});
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAttendanceRecord, setSelectedAttendanceRecord] = useState(null);
  const [selectedDateForModal, setSelectedDateForModal] = useState(null);
  const [editFormData, setEditFormData] = useState({
    status: '',
    workingHours: 0,
    lateByMinutes: 0,
    checkInTime: '',
    checkOutTime: '',
    remarks: ''
  });
  const [summary, setSummary] = useState({
    present: 0,
    absent: 0,
    late: 0,
    halfDay: 0,
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmployee) {
      fetchAttendance();
    }
  }, [currentMonth, selectedEmployee]);

  const fetchEmployees = async () => {
    try {
      const response = await employeeAPI.getAll();
      const employeesData = response?.data?.data?.employees || [];
      setEmployees(employeesData);
      if (employeesData.length > 0 && !selectedEmployee) {
        setSelectedEmployee(employeesData[0]._id);
      }
    } catch (error) {
      console.log(error);
      toast.error('Failed to fetch employees');
    }
  };

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const month = format(currentMonth, 'MM');
      const year = format(currentMonth, 'yyyy');
      
      const response = await attendanceAPI.getAll({
        month,
        year,
        employeeId: selectedEmployee
      });

      const records = response?.data?.data?.records || [];
      const attendanceMap = {};
      let present = 0, absent = 0, late = 0, halfDay = 0;

      records.forEach((record) => {
        const dateKey = format(new Date(record.date), 'yyyy-MM-dd');
        let calendarStatus = 'present';

        if (record.status === 'absent') {
          calendarStatus = 'absent';
          absent++;
        } else if (record.status === 'half-day') {
          calendarStatus = 'half-day';
          halfDay++;
        } else if (record.isLate) {
          calendarStatus = 'late';
          late++;
        } else if (record.status === 'present') {
          calendarStatus = 'present';
          present++;
        }

        attendanceMap[dateKey] = { ...record, calendarStatus };
      });

      setAttendanceData(attendanceMap);
      setSummary({ present, absent, late, halfDay });
    } catch (error) {
      console.log(error);
      toast.error('Failed to fetch attendance data');
    } finally {
      setLoading(false);
    }
  };

  const generateCalendarDays = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const days = [];
    let day = startDate;
    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  };

  const calendarDays = generateCalendarDays();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getStatusClass = (status) => {
    switch (status) {
      case 'present': return 'bg-green';
      case 'absent': return 'bg-red';
      case 'late':
      case 'half-day': return 'bg-yellow';
      default: return 'bg-gray';
    }
  };

  const handleDateClick = (day, attendance) => {
    setSelectedDateForModal(day);
    if (attendance) {
      setSelectedAttendanceRecord(attendance);
      setEditFormData({
        status: attendance.status || 'present',
        workingHours: attendance.workingHours || 0,
        lateByMinutes: attendance.lateByMinutes || 0,
        checkInTime: attendance.checkIns?.[0]?.time ? format(new Date(attendance.checkIns[0].time), 'HH:mm') : '',
        checkOutTime: attendance.checkOuts?.[0]?.time ? format(new Date(attendance.checkOuts[0].time), 'HH:mm') : '',
        remarks: attendance.remarks || ''
      });
      setShowEditModal(true);
    } else {
      setSelectedAttendanceRecord(null);
      setEditFormData({
        status: 'present',
        workingHours: 8,
        lateByMinutes: 0,
        checkInTime: '09:00',
        checkOutTime: '17:00',
        remarks: ''
      });
      setShowEditModal(true);
    }
  };

  const saveAttendance = async () => {
    const toastId = toast.loading(selectedAttendanceRecord ? 'Updating attendance...' : 'Saving attendance...');
    
    try {
      const date = selectedAttendanceRecord?.date || format(selectedDateForModal, 'yyyy-MM-dd');
      
      const payload = {
        employeeId: selectedEmployee,
        date: date,
        status: editFormData.status,
        workingHours: parseFloat(editFormData.workingHours),
        lateByMinutes: parseInt(editFormData.lateByMinutes),
        isLate: parseInt(editFormData.lateByMinutes) > 0,
        checkInTime: editFormData.checkInTime ? `${editFormData.checkInTime}:00` : null,
        checkOutTime: editFormData.checkOutTime ? `${editFormData.checkOutTime}:00` : null,
        remarks: editFormData.remarks
      };

      let response;
      if (selectedAttendanceRecord) {
        response = await attendanceAPI.update(selectedAttendanceRecord._id, payload);
      } else {
        response = await attendanceAPI.create(payload);
      }

      if (response.data.success || response.status === 200 || response.status === 201) {
        await fetchAttendance();
        setShowEditModal(false);
        toast.success(selectedAttendanceRecord ? 'Attendance updated successfully!' : 'Attendance saved successfully!', { id: toastId });
      }
    } catch (error) {
      console.error('Error saving attendance:', error);
      toast.error(error.response?.data?.message || 'Failed to save attendance', { id: toastId });
    }
  };

  const deleteAttendance = async () => {
    if (!selectedAttendanceRecord) return;
    
    toast((t) => (
      <div>
        <p className="mb-2">Are you sure you want to delete this attendance record?</p>
        <div className="flex gap-2 justify-end">
          <button
            className="px-3 py-1 bg-red-500 text-white rounded text-sm"
            onClick={async () => {
              toast.dismiss(t.id);
              const toastId = toast.loading('Deleting attendance...');
              try {
                await attendanceAPI.delete(selectedAttendanceRecord._id);
                await fetchAttendance();
                setShowEditModal(false);
                toast.success('Attendance deleted successfully!', { id: toastId });
              } catch (error) {
                console.error('Error deleting attendance:', error);
                toast.error('Failed to delete attendance', { id: toastId });
              }
            }}
          >
            Delete
          </button>
          <button
            className="px-3 py-1 bg-gray-500 text-white rounded text-sm"
            onClick={() => toast.dismiss(t.id)}
          >
            Cancel
          </button>
        </div>
      </div>
    ), { duration: 5000 });
  };

  const markBulkAttendance = async () => {
    const status = prompt('Enter status for all days (present/absent/half-day):', 'present');
    if (status && ['present', 'absent', 'half-day'].includes(status)) {
      const toastId = toast.loading(`Marking all days as ${status}...`);
      try {
        await attendanceAPI.bulkUpdate({
          employeeId: selectedEmployee,
          month: format(currentMonth, 'MM'),
          year: format(currentMonth, 'yyyy'),
          status: status
        });
        await fetchAttendance();
        toast.success(`Marked all days as ${status} successfully!`, { id: toastId });
      } catch (error) {
        console.error('Error marking bulk attendance:', error);
        toast.error('Failed to update bulk attendance', { id: toastId });
      }
    }
  };

  return (
    <>
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
            borderRadius: '10px',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#22c55e',
              secondary: '#fff',
            },
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      
      <style>{`
        * { box-sizing: border-box; }
        
        .attendance-wrapper {
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 20px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        
        .attendance-card {
          max-width: 1400px;
          margin: auto;
          background: #fff;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0,0,0,0.15);
        }
        
        .top-header {
          padding: 24px 28px;
          background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 15px;
        }
        
        .title-box h2 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
        }
        
        .title-box p {
          margin-top: 5px;
          opacity: 0.9;
          font-size: 14px;
        }
        
        .controls {
          display: flex;
          align-items: center;
          gap: 15px;
          flex-wrap: wrap;
        }
        
        .employee-select {
          min-width: 260px;
          height: 45px;
          border: none;
          border-radius: 12px;
          padding: 0 15px;
          outline: none;
          font-size: 14px;
          background: rgba(255,255,255,0.95);
          cursor: pointer;
        }
        
        .bulk-btn {
          background: rgba(255,255,255,0.2);
          border: 1px solid rgba(255,255,255,0.3);
          color: white;
          padding: 8px 16px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.3s;
        }
        
        .bulk-btn:hover {
          background: rgba(255,255,255,0.3);
        }
        
        .month-navigation {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(255,255,255,0.15);
          padding: 5px 15px;
          border-radius: 50px;
        }
        
        .nav-btn {
          width: 36px;
          height: 36px;
          border: none;
          border-radius: 10px;
          background: rgba(255,255,255,0.2);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: 0.3s;
          color: white;
        }
        
        .nav-btn:hover {
          background: rgba(255,255,255,0.4);
        }
        
        .month-title {
          min-width: 170px;
          text-align: center;
          font-weight: 700;
          font-size: 18px;
        }
        
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          padding: 24px 28px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .summary-card {
          background: white;
          border-radius: 16px;
          padding: 20px;
          position: relative;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          transition: transform 0.2s;
        }
        
        .summary-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0,0,0,0.08);
        }
        
        .summary-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 4px;
          height: 100%;
          border-radius: 16px 0 0 16px;
        }
        
        .green-card::before { background: #22c55e; }
        .red-card::before { background: #ef4444; }
        .yellow-card::before { background: #eab308; }
        .orange-card::before { background: #f97316; }
        
        .summary-title {
          font-size: 13px;
          color: #64748b;
          margin-bottom: 8px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .summary-value {
          font-size: 32px;
          font-weight: 800;
        }
        
        .week-header {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          background: #f1f5f9;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .week-header div {
          text-align: center;
          padding: 16px 0;
          font-weight: 700;
          color: #475569;
          font-size: 14px;
          text-transform: uppercase;
        }
        
        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
        }
        
        .calendar-cell {
          min-height: 130px;
          border-right: 1px solid #f1f5f9;
          border-bottom: 1px solid #f1f5f9;
          padding: 10px;
          background: #fff;
          transition: 0.2s;
          cursor: pointer;
          position: relative;
        }
        
        .calendar-cell:hover {
          background: #fefce8;
          transform: scale(1.01);
          z-index: 1;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        .inactive {
          background: #faf9f6;
          opacity: 0.6;
        }
        
        .today {
          background: #eff6ff;
          box-shadow: inset 0 0 0 2px #3b82f6;
        }
        
        .date-number {
          font-size: 15px;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 8px;
        }
        
        .attendance-box {
          margin-top: 8px;
          padding: 8px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          color: white;
          font-size: 12px;
          font-weight: 700;
          gap: 5px;
          cursor: pointer;
          transition: 0.2s;
        }
        
        .attendance-box svg {
          width: 18px;
          height: 18px;
        }
        
        .bg-green { background: linear-gradient(135deg, #22c55e, #16a34a); }
        .bg-red { background: linear-gradient(135deg, #ef4444, #dc2626); }
        .bg-yellow { background: linear-gradient(135deg, #eab308, #ca8a04); }
        .bg-gray { background: linear-gradient(135deg, #94a3b8, #64748b); }
        
        .late-text {
          font-size: 10px;
          background: rgba(255,255,255,0.3);
          padding: 2px 8px;
          border-radius: 20px;
          margin-top: 4px;
        }
        
        .edit-badge {
          position: absolute;
          bottom: 8px;
          right: 8px;
          background: rgba(0,0,0,0.5);
          border-radius: 20px;
          padding: 2px 6px;
          font-size: 10px;
          color: white;
        }
        
        /* Modal Styles */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
        }
        
        .modal-container {
          background: white;
          border-radius: 24px;
          max-width: 600px;
          width: 90%;
          max-height: 85vh;
          overflow-y: auto;
          animation: slideIn 0.3s ease;
        }
        
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .modal-header {
          padding: 20px 24px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 24px 24px 0 0;
        }
        
        .modal-header h3 {
          margin: 0;
          font-size: 20px;
        }
        
        .modal-body {
          padding: 24px;
        }
        
        .form-group {
          margin-bottom: 20px;
        }
        
        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #1e293b;
          font-size: 14px;
        }
        
        .form-group input,
        .form-group select,
        .form-group textarea {
          width: 100%;
          padding: 10px 14px;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          font-size: 14px;
          transition: 0.2s;
        }
        
        .form-group input:focus,
        .form-group select:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102,126,234,0.1);
        }
        
        .modal-footer {
          padding: 16px 24px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }
        
        .btn-save {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          border: none;
          padding: 10px 24px;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 600;
        }
        
        .btn-delete {
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: white;
          border: none;
          padding: 10px 24px;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 600;
        }
        
        .btn-cancel {
          background: #94a3b8;
          color: white;
          border: none;
          padding: 10px 24px;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 600;
        }
        
        .loading {
          padding: 40px;
          text-align: center;
          font-weight: 600;
          color: #64748b;
        }
        
        @media (max-width: 768px) {
          .summary-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
            padding: 16px;
          }
          
          .calendar-cell {
            min-height: 100px;
          }
          
          .attendance-box {
            font-size: 10px;
            padding: 4px;
          }
          
          .top-header {
            flex-direction: column;
            align-items: stretch;
          }
        }
      `}</style>

      <div className="attendance-wrapper">
        <div className="attendance-card">
          {/* HEADER */}
          <div className="top-header">
            <div className="title-box">
              <h2>📋 Attendance Management</h2>
              <p>Manage employee attendance, mark present/absent, edit records</p>
            </div>
            <div className="controls">
              <select
                className="employee-select"
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
              >
                {employees.map((employee) => (
                  <option key={employee._id} value={employee._id}>
                    👤 {employee.name} ({employee.employeeCode})
                  </option>
                ))}
              </select>
              <button className="bulk-btn" onClick={markBulkAttendance}>
                📦 Bulk Mark
              </button>
              <div className="month-navigation">
                <button className="nav-btn" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft size={18} />
                </button>
                <div className="month-title">{format(currentMonth, 'MMMM yyyy')}</div>
                <button className="nav-btn" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* SUMMARY */}
          <div className="summary-grid">
            <div className="summary-card green-card">
              <div className="summary-title">✅ Present</div>
              <div className="summary-value" style={{ color: '#22c55e' }}>{summary.present}</div>
            </div>
            <div className="summary-card red-card">
              <div className="summary-title">❌ Absent</div>
              <div className="summary-value" style={{ color: '#ef4444' }}>{summary.absent}</div>
            </div>
            <div className="summary-card yellow-card">
              <div className="summary-title">⏰ Late</div>
              <div className="summary-value" style={{ color: '#eab308' }}>{summary.late}</div>
            </div>
            <div className="summary-card orange-card">
              <div className="summary-title">🌙 Half Day</div>
              <div className="summary-value" style={{ color: '#f97316' }}>{summary.halfDay}</div>
            </div>
          </div>

          {/* WEEK HEADER */}
          <div className="week-header">
            {weekDays.map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          {/* CALENDAR */}
          <div className="calendar-grid">
            {calendarDays.map((day, index) => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const attendance = attendanceData[dateKey];

              return (
                <div
                  key={index}
                  className={`calendar-cell ${
                    !isSameMonth(day, currentMonth) ? 'inactive' : ''
                  } ${isToday(day) ? 'today' : ''}`}
                  onClick={() => handleDateClick(day, attendance)}
                >
                  <div className="date-number">{format(day, 'dd')}</div>
                  {attendance && (
                    <div className={`attendance-box ${getStatusClass(attendance.calendarStatus)}`}>
                      {attendance.calendarStatus === 'present' && (
                        <>
                          <CheckCircle /> Present
                        </>
                      )}
                      {attendance.calendarStatus === 'absent' && (
                        <>
                          <XCircle /> Absent
                        </>
                      )}
                      {attendance.calendarStatus === 'late' && (
                        <>
                          <AlertCircle /> Late
                          <span className="late-text">{attendance.lateByMinutes} min</span>
                        </>
                      )}
                      {attendance.calendarStatus === 'half-day' && (
                        <>
                          <AlertCircle /> Half Day
                        </>
                      )}
                    </div>
                  )}
                  <div className="edit-badge">✎</div>
                </div>
              );
            })}
          </div>

          {loading && <div className="loading">Loading attendance...</div>}
        </div>
      </div>

      {/* EDIT MODAL */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedAttendanceRecord ? '✏️ Edit Attendance' : '➕ Add Attendance'}</h3>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Status</label>
                <select value={editFormData.status} onChange={(e) => setEditFormData({...editFormData, status: e.target.value})}>
                  <option value="present">✅ Present</option>
                  <option value="absent">❌ Absent</option>
                  <option value="half-day">🌙 Half Day</option>
                </select>
              </div>
              <div className="form-group">
                <label>Working Hours</label>
                <input type="number" step="0.5" value={editFormData.workingHours} onChange={(e) => setEditFormData({...editFormData, workingHours: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Late By (minutes)</label>
                <input type="number" value={editFormData.lateByMinutes} onChange={(e) => setEditFormData({...editFormData, lateByMinutes: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Check In Time</label>
                <input type="time" value={editFormData.checkInTime} onChange={(e) => setEditFormData({...editFormData, checkInTime: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Check Out Time</label>
                <input type="time" value={editFormData.checkOutTime} onChange={(e) => setEditFormData({...editFormData, checkOutTime: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Remarks</label>
                <textarea rows="3" value={editFormData.remarks} onChange={(e) => setEditFormData({...editFormData, remarks: e.target.value})} placeholder="Add any remarks..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowEditModal(false)}>Cancel</button>
              {selectedAttendanceRecord && (
                <button className="btn-delete" onClick={deleteAttendance}>Delete</button>
              )}
              <button className="btn-save" onClick={saveAttendance}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EmployeeAttendanceCalendar;