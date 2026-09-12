import React from "react";

const AIRiskBadge = ({ level }) => {
  const normalizedLevel = String(level || "low").toLowerCase();

  const labelMap = {
    low: "LOW",
    medium: "MEDIUM",
    high: "HIGH",
    critical: "CRITICAL",
  };

  return (
    <span className={`ai-risk-badge ai-risk-${normalizedLevel}`}>
      {labelMap[normalizedLevel] || "LOW"}
    </span>
  );
};

export default AIRiskBadge;