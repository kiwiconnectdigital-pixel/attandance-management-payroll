import React from "react";

const AIRiskStats = ({ summary }) => {
  if (!summary) {
    return null;
  }

  const cards = [
    {
      title: "Total Alerts",
      value: summary.total ?? 0,
    },
    {
      title: "Low Risk",
      value: summary.low ?? 0,
    },
    {
      title: "Medium Risk",
      value: summary.medium ?? 0,
    },
    {
      title: "High Risk",
      value: summary.high ?? 0,
    },
    {
      title: "Critical",
      value: summary.critical ?? 0,
    },
    {
      title: "Open Reviews",
      value: summary.open ?? 0,
    },
  ];

  return (
    <div className="ai-risk-stats">

      {cards.map((card) => (
        <div
          className="ai-risk-stat-card"
          key={card.title}
        >
          <div className="ai-risk-stat-title">
            {card.title}
          </div>

          <div className="ai-risk-stat-value">
            {card.value}
          </div>
        </div>
      ))}

    </div>
  );
};

export default AIRiskStats;