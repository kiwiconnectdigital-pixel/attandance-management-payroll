import React from "react";

const findingLabels = {
  unusual_checkin_pattern: "Unusual Check-in Pattern",
  repeated_late_arrivals: "Repeated Late Arrivals",
  suspicious_attendance: "Suspicious Attendance Pattern",
  multiple_employees_same_device:
    "Multiple Employees Using Same Device",
  impossible_gps_movement: "Impossible GPS Movement",
  frequent_location_changes:
    "Frequent Location Changes",
  unusual_overtime: "Unusual Overtime",
  possible_attendance_manipulation:
    "Possible Attendance Manipulation",
};

const AIFindingCard = ({ finding }) => {
  if (!finding) return null;

  const title =
    findingLabels[finding.type] ||
    String(finding.type || "Attendance Anomaly")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());

  const severity = String(
    finding.severity || "medium"
  ).toLowerCase();

  return (
    <div className="ai-finding-card">

      <div className="ai-finding-header">
        <h4>{title}</h4>

        <span
          className={`ai-finding-severity severity-${severity}`}
        >
          {severity.toUpperCase()}
        </span>
      </div>

      <p>
        {finding.explanation ||
          "An attendance anomaly was detected."}
      </p>

    </div>
  );
};

export default AIFindingCard;