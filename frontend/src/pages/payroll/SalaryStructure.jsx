import { formatINR } from '../../utils/helpers';
import {
  BanknotesIcon,
  MinusCircleIcon,
  PlusCircleIcon,
} from '@heroicons/react/24/outline';

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export default function SalaryStructure({
  salary = {},
  deductions = null,
}) {
  const basicDA =
    num(salary.basic) +
    num(salary.da);

  const hra = num(salary.hra);
  const conveyance = num(salary.ta);

  const incentive =
    num(salary.bonus) +
    num(salary.overtime) +
    num(salary.other);

  const earningsTotal =
    basicDA +
    hra +
    conveyance +
    incentive;

  const pf = num(deductions?.pf);
  const esic = num(deductions?.esic);
  const advance = num(deductions?.advance);
  const pt = num(deductions?.pt);

  const dedTotal =
    pf +
    esic +
    advance +
    pt;

  const netSalary =
    earningsTotal -
    dedTotal;

  const earningRows = [
    {
      label: 'Basic & DA',
      value: basicDA,
      highlight: true,
    },
    {
      label: 'HRA',
      value: hra,
    },
    {
      label: 'Conveyance',
      value: conveyance,
    },
    {
      label: 'Incentive',
      value: incentive,
    },
  ];

  const deductionRows = [
    {
      label: 'Provident Fund',
      value: pf,
    },
    {
      label: 'E.S.I.',
      value: esic,
    },
    {
      label: 'Advance',
      value: advance,
    },
    {
      label: 'Professional Tax',
      value: pt,
    },
  ];

  return (
    <div className="salary-structure">

      <style>{`
        .salary-structure {
          width: 100%;
          overflow: hidden;
          border: 1px solid #E7E9ED;
          border-radius: 14px;
          background: #FFFFFF;
          color: #15171C;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
          box-shadow: 0 1px 2px rgba(15, 23, 42, .025);
        }

        .salary-structure *,
        .salary-structure *::before,
        .salary-structure *::after {
          box-sizing: border-box;
        }

        /* Header */

        .salary-structure-header {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 120px minmax(0, 1fr) 120px;
          align-items: center;
          min-height: 46px;
          background: #FAFBFC;
          border-bottom: 1px solid #E7E9ED;
        }

        .salary-header-cell {
          height: 100%;
          display: flex;
          align-items: center;
          padding: 0 13px;
          color: #676C76;
          font-size: 9px;
          font-weight: 750;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .salary-header-cell.amount {
          justify-content: flex-end;
          border-right: 1px solid #E7E9ED;
        }

        .salary-header-cell:last-child {
          border-right: 0;
        }

        .salary-header-title {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .salary-header-icon {
          display: grid;
          place-items: center;
          width: 24px;
          height: 24px;
          border-radius: 7px;
        }

        .salary-header-icon.earning {
          background: #EAF7F1;
          color: #16845B;
        }

        .salary-header-icon.deduction {
          background: #FDEEEE;
          color: #C94B4B;
        }

        /* Rows */

        .salary-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 120px minmax(0, 1fr) 120px;
          min-height: 43px;
          border-bottom: 1px solid #F0F1F3;
          transition: background .15s ease;
        }

        .salary-row:hover {
          background: #FBFCFE;
        }

        .salary-cell {
          display: flex;
          align-items: center;
          min-width: 0;
          padding: 9px 13px;
          color: #676C76;
          font-size: 12px;
        }

        .salary-cell.amount {
          justify-content: flex-end;
          color: #15171C;
          font-weight: 650;
          border-right: 1px solid #E7E9ED;
          white-space: nowrap;
        }

        .salary-cell.deduction-amount {
          color: #C94B4B;
        }

        .salary-cell.empty {
          border-right: 0;
        }

        .salary-label {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .salary-value {
          font-variant-numeric: tabular-nums;
        }

        .salary-value.zero {
          color: #969BA5;
          font-weight: 500;
        }

        .salary-value.positive {
          color: #16845B;
        }

        /* Totals */

        .salary-total-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 120px minmax(0, 1fr) 120px;
          min-height: 52px;
          background: #FAFBFC;
          border-top: 1px solid #D9DDE3;
        }

        .salary-total-cell {
          display: flex;
          align-items: center;
          min-width: 0;
          padding: 10px 13px;
          color: #15171C;
          font-size: 12px;
          font-weight: 750;
        }

        .salary-total-cell.amount {
          justify-content: flex-end;
          color: #16845B;
          border-right: 1px solid #E7E9ED;
          white-space: nowrap;
        }

        .salary-total-cell.net-label {
          color: #3567D6;
        }

        .salary-total-cell.net-value {
          justify-content: flex-end;
          color: #3567D6;
          font-size: 14px;
          border-right: 0;
          white-space: nowrap;
        }

        .salary-total-content {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .salary-total-icon {
          width: 16px;
          height: 16px;
        }

        /* Footer */

        .salary-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          padding: 11px 13px;
          background: #FFFFFF;
          border-top: 1px solid #F0F1F3;
        }

        .salary-footer-note {
          color: #969BA5;
          font-size: 10px;
        }

        .salary-footer-net {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 5px 9px;
          border-radius: 7px;
          background: #EDF3FF;
          color: #3567D6;
          font-size: 10px;
          font-weight: 750;
        }

        @media (max-width: 700px) {
          .salary-structure-header,
          .salary-row,
          .salary-total-row {
            grid-template-columns:
              minmax(0, 1fr)
              95px
              minmax(0, 1fr)
              95px;
          }

          .salary-header-cell,
          .salary-cell,
          .salary-total-cell {
            padding-left: 9px;
            padding-right: 9px;
          }
        }

        @media (max-width: 560px) {
          .salary-structure {
            overflow-x: auto;
          }

          .salary-structure-header,
          .salary-row,
          .salary-total-row {
            min-width: 610px;
          }

          .salary-footer {
            min-width: 610px;
          }
        }
      `}</style>

      {/* HEADER */}
      <div className="salary-structure-header">

        <div className="salary-header-cell">
          <div className="salary-header-title">
            <span className="salary-header-icon earning">
              <PlusCircleIcon width={14} />
            </span>

            Earnings
          </div>
        </div>

        <div className="salary-header-cell amount">
          Amount
        </div>

        <div className="salary-header-cell">
          <div className="salary-header-title">
            <span className="salary-header-icon deduction">
              <MinusCircleIcon width={14} />
            </span>

            Deductions
          </div>
        </div>

        <div className="salary-header-cell amount">
          Amount
        </div>

      </div>

      {/* DATA ROWS */}
      {earningRows.map((earning, index) => {
        const deduction =
          deductionRows[index];

        const earningValue =
          num(earning.value);

        const deductionValue =
          num(deduction?.value);

        return (
          <div
            key={earning.label}
            className="salary-row"
          >

            {/* EARNING LABEL */}
            <div className="salary-cell">
              <span className="salary-label">
                {earning.label}
              </span>
            </div>

            {/* EARNING VALUE */}
            <div className="salary-cell amount">
              <span
                className={
                  `salary-value ${
                    earningValue > 0
                      ? 'positive'
                      : 'zero'
                  }`
                }
              >
                {formatINR(earningValue)}
              </span>
            </div>

            {/* DEDUCTION LABEL */}
            {deductions && deduction ? (
              <>
                <div className="salary-cell">
                  <span className="salary-label">
                    {deduction.label}
                  </span>
                </div>

                <div className="salary-cell amount deduction-amount">
                  <span
                    className={
                      `salary-value ${
                        deductionValue > 0
                          ? ''
                          : 'zero'
                      }`
                    }
                  >
                    {deductionValue > 0
                      ? `− ${formatINR(
                          deductionValue
                        )}`
                      : '—'}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="salary-cell empty" />
                <div className="salary-cell amount empty" />
              </>
            )}

          </div>
        );
      })}

      {/* TOTALS */}
      <div className="salary-total-row">

        <div className="salary-total-cell">
          <div className="salary-total-content">
            <BanknotesIcon
              className="salary-total-icon"
              style={{ color: '#16845B' }}
            />

            Total Earnings
          </div>
        </div>

        <div className="salary-total-cell amount">
          {formatINR(earningsTotal)}
        </div>

        {deductions ? (
          <>
            <div className="salary-total-cell net-label">
              Net Salary
            </div>

            <div className="salary-total-cell net-value">
              {formatINR(netSalary)}
            </div>
          </>
        ) : (
          <>
            <div className="salary-total-cell" />
            <div className="salary-total-cell" />
          </>
        )}

      </div>

      {/* FOOTER */}
      {deductions && (
        <div className="salary-footer">

          <span className="salary-footer-note">
            Total deductions: {formatINR(dedTotal)}
          </span>

          <span className="salary-footer-net">
            Net payable
            <strong>
              {formatINR(netSalary)}
            </strong>
          </span>

        </div>
      )}

    </div>
  );
}