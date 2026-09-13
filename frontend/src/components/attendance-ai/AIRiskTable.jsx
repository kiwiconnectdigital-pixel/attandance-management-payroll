import React from "react";
import { useNavigate } from "react-router-dom";
import AIRiskBadge from "./AIRiskBadge";

const AIRiskTable = ({ risks = [] }) => {
  const navigate = useNavigate();

  const getFinding = (risk) => {
    if (!risk.findings?.length) {
      return "Attendance anomaly";
    }

    const finding = risk.findings[0];

    return String(
      finding.type || "Attendance anomaly"
    )
      .replaceAll("_", " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  return (
    <div className="ai-risk-table-wrapper">

      <table className="ai-risk-table">

        <thead>
          <tr>
            <th>Employee</th>
            <th>Employee Code</th>
            <th>Risk Score</th>
            <th>Risk Level</th>
            <th>Finding</th>
            <th>Status</th>
            <th>Analyzed At</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>

          {risks.map((risk) => (

            <tr key={risk.id}>

              <td>
                <strong>
                  {risk.employeeName || "-"}
                </strong>
              </td>

              <td>
                {risk.employeeCode || "-"}
              </td>

              <td>
                <strong>
                  {risk.riskScore ?? 0}
                </strong>
                /100
              </td>

              <td>
                <AIRiskBadge
                  level={risk.riskLevel}
                />
              </td>

              <td>
                {getFinding(risk)}
              </td>

              <td>
                <span className="ai-status-badge">
                  {String(
                    risk.status || "open"
                  ).toUpperCase()}
                </span>
              </td>

              <td>
                {risk.analyzedAt
                  ? new Date(
                      risk.analyzedAt
                    ).toLocaleString("en-IN")
                  : "-"}
              </td>

              <td>

                <button
                  className="ai-view-button"
                  onClick={() =>
                    navigate(
                      `/attendance-ai/${risk.id}`
                    )
                  }
                >
                  View
                </button>

              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>
  );
};

export default AIRiskTable;