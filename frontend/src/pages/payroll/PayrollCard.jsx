import { formatINR } from '../../utils/helpers';
import { getStatusBadge } from '../../utils/helpers';

export default function PayrollCard({ payroll, onGeneratePayslip, onMarkPaid }) {
  const monthName = new Date(2000, payroll.month - 1).toLocaleString('default', { month: 'long' });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">{payroll.employee?.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{payroll.employee?.department} · {monthName} {payroll.year}</p>
        </div>
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(payroll.status)}`}>
          {payroll.status}
        </span>
      </div>

      <div className="space-y-2">
        {[
          { label: 'Gross Salary', value: formatINR(payroll.grossSalary), color: 'text-gray-900' },
          { label: 'PF', value: `- ${formatINR(payroll.deductions?.pf)}`, color: 'text-red-500' },
          { label: 'ESIC', value: `- ${formatINR(payroll.deductions?.esic)}`, color: 'text-red-500' },
          { label: 'PT', value: `- ${formatINR(payroll.deductions?.pt)}`, color: 'text-red-500' },
          { label: 'TDS', value: `- ${formatINR(payroll.deductions?.tds)}`, color: 'text-red-500' },
          { label: 'LOP', value: `- ${formatINR(payroll.deductions?.lop)}`, color: 'text-red-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex justify-between text-sm">
            <span className="text-gray-500">{label}</span>
            <span className={`font-medium ${color}`}>{value}</span>
          </div>
        ))}
        <div className="flex justify-between text-sm font-bold border-t pt-2">
          <span>Net Salary</span>
          <span className="text-indigo-600 text-base">{formatINR(payroll.netSalary)}</span>
        </div>
      </div>

      {payroll.attendanceSummary && (
        <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 gap-2 text-center">
          {[
            { label: 'Present', value: payroll.attendanceSummary.presentDays },
            { label: 'Absent', value: payroll.attendanceSummary.absentDays },
            { label: 'OT Hrs', value: `${payroll.attendanceSummary.overtimeHours?.toFixed(1)}h` },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-sm font-semibold text-gray-900">{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 mt-4">
        {payroll.status === 'processed' && onMarkPaid && (
          <button onClick={() => onMarkPaid(payroll._id)}
            className="flex-1 py-2 bg-green-50 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100">
            Mark Paid
          </button>
        )}
        {onGeneratePayslip && (
          <button onClick={() => onGeneratePayslip(payroll._id)}
            className="flex-1 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium hover:bg-indigo-100">
            Generate Payslip
          </button>
        )}
      </div>
    </div>
  );
}