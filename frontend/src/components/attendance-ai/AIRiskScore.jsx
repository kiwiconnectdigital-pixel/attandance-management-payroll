import React from "react";
import AIRiskBadge from "./AIRiskBadge";

const AIRiskScore = ({ score = 0, level = "low" }) => {
  return (
    <div className="ai-risk-score-wrapper">
      <div className="ai-risk-score-number">
        {score}
        <span>/100</span>
      </div>

      <AIRiskBadge level={level} />
    </div>
  );
};

export default AIRiskScore;