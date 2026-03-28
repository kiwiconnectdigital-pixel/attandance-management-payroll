import { formatINR } from '../../utils/helpers';

/**
 * Display-only salary breakdown component
 * Used in employee profile and payroll preview
 */
export default function SalaryStructure({ salary = {}, deductions = null }) {
  const gross = Object.values(salary).reduce((s, v) => s + (v || 0), 0);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Earnings</p>
        {[
          { label: 'Basic', value: salary.basic },
          { label: 'HRA', value: salary.hra },
          { label: 'DA', value: salary.da },
          { label: 'TA', value: salary.ta },
          { label: 'Other', value: salary.other },
        ].map(({ label, value }) => (
          value > 0 && (
            <div key={label} className="flex justify-between text-sm py-1">
              <span className="text-gray-500">{label}</span>
              <span className="font-medium text-gray-900">{formatINR(value)}</span>
            </div>
          )
        ))}
        <div className="flex justify-between text-sm font-bold border-t border-gray-100 pt-2 mt-1">
          <span>Gross</span>
          <span className="text-green-600">{formatINR(gross)}</span>
        </div>
      </div>

      {deductions && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 pt-2 border-t">Deductions</p>
          {[
            { label: 'PF (12%)', value: deductions.pf },
            { label: 'ESIC (0.75%)', value: deductions.esic },
            { label: 'Prof. Tax', value: deductions.pt },
            { label: 'TDS', value: deductions.tds },
            { label: 'LOP', value: deductions.lop },
          ].map(({ label, value }) => (
            value > 0 && (
              <div key={label} className="flex justify-between text-sm py-1">
                <span className="text-gray-500">{label}</span>
                <span className="font-medium text-red-600">- {formatINR(value)}</span>
              </div>
            )
          ))}
          <div className="flex justify-between text-sm font-bold border-t border-gray-100 pt-2 mt-1">
            <span>Net Salary</span>
            <span className="text-indigo-600">{formatINR(gross - Object.values(deductions).reduce((s, v) => s + (v || 0), 0))}</span>
          </div>
        </div>
      )}
    </div>
  );
}