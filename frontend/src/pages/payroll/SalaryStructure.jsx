import { formatINR } from '../../utils/helpers';

/**
 * SalaryStructure — display-only component matching the Apex Engineering payslip layout.
 * Shows: Basic & DA | HRA | Conveyance | Incentive on the earnings side
 *        PF | ESI | Advance | Professional Tax on the deductions side
 */
export default function SalaryStructure({ salary = {}, deductions = null }) {
  // Earnings grouping (mirrors the payslip PDF)
  const basicDA    = (salary.basic || 0) + (salary.da || 0);
  const hra        = salary.hra || 0;
  const conveyance = salary.ta  || 0;
  const incentive  = (salary.bonus || 0) + (salary.overtime || 0) + (salary.other || 0);
  const earningsTotal = basicDA + hra + conveyance + incentive;

  // Deductions grouping
  const dedTotal = deductions
    ? (deductions.pf || 0) + (deductions.esic || 0) + (deductions.advance || 0) + (deductions.pt || 0)
    : 0;

  const earningRows = [
    { label: 'Basic & DA',   value: basicDA },
    { label: 'HRA',          value: hra },
    { label: 'Conveyance',   value: conveyance },
    { label: 'Incentive',    value: incentive },
  ];

  const deductionRows = [
    { label: 'Provident Fund',    value: deductions?.pf      || 0 },
    { label: 'E.S.I.',           value: deductions?.esic     || 0 },
    { label: 'Advance',          value: deductions?.advance  || 0 },
    { label: 'Professional Tax', value: deductions?.pt       || 0 },
  ];

  return (
    <div className="overflow-hidden rounded border border-gray-200 text-sm">
      {/* Table header */}
      <div className="grid grid-cols-4 bg-gray-100 font-semibold text-gray-700 text-xs uppercase tracking-wide">
        <div className="px-3 py-2 col-span-1">Earnings</div>
        <div className="px-3 py-2 text-right border-r border-gray-200">Amount</div>
        <div className="px-3 py-2 col-span-1">Deductions</div>
        <div className="px-3 py-2 text-right">Amount</div>
      </div>

      {/* Data rows */}
      {earningRows.map(({ label, value }, i) => (
        <div
          key={label}
          className="grid grid-cols-4 border-t border-gray-100 hover:bg-gray-50"
        >
          <div className="px-3 py-1.5 text-gray-600">{label}</div>
          <div className="px-3 py-1.5 text-right text-gray-800 border-r border-gray-200">
            {formatINR(value)}
          </div>
          {deductions && deductionRows[i] ? (
            <>
              <div className="px-3 py-1.5 text-gray-600">{deductionRows[i].label}</div>
              <div className="px-3 py-1.5 text-right text-red-600">
                {deductionRows[i].value > 0 ? `- ${formatINR(deductionRows[i].value)}` : '—'}
              </div>
            </>
          ) : (
            <div className="col-span-2" />
          )}
        </div>
      ))}

      {/* Totals row */}
      <div className="grid grid-cols-4 border-t-2 border-gray-300 bg-gray-50 font-bold text-gray-800">
        <div className="px-3 py-2">Total</div>
        <div className="px-3 py-2 text-right text-green-700 border-r border-gray-200">
          {formatINR(earningsTotal)}
        </div>
        {deductions ? (
          <>
            <div className="px-3 py-2">Net Salary</div>
            <div className="px-3 py-2 text-right text-indigo-700">
              {formatINR(earningsTotal - dedTotal)}
            </div>
          </>
        ) : (
          <div className="col-span-2" />
        )}
      </div>
    </div>
  );
}