import React, {
  useEffect,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  getAIRiskById,
  reviewAIRisk,
} from "../../api/attendanceAiRiskApi";

import AIRiskBadge from "../../components/attendance-ai/AIRiskBadge";
import AIRiskScore from "../../components/attendance-ai/AIRiskScore";
import AIFindingCard from "../../components/attendance-ai/AIFindingCard";

import "./AttendanceAi.css";

const AttendanceAiDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [risk, setRisk] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] =
    useState(false);
  const [error, setError] = useState("");

  const loadRisk = async () => {
    try {
      setLoading(true);
      setError("");

      const response =
        await getAIRiskById(id);

      setRisk(
        response?.data || null
      );
    } catch (error) {
      console.error(
        "AI Risk Details Error:",
        error
      );

      setError(
        "Unable to load AI risk details."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRisk();
  }, [id]);

  const handleReview = async (status) => {
    try {
      setActionLoading(true);

      await reviewAIRisk(
        id,
        status
      );

      await loadRisk();
    } catch (error) {
      console.error(
        "AI Review Error:",
        error
      );

      alert(
        "Unable to update AI risk status."
      );
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="attendance-ai-page">
        <div className="ai-loading">
          Loading AI risk details...
        </div>
      </div>
    );
  }

  if (error || !risk) {
    return (
      <div className="attendance-ai-page">

        <button
          onClick={() =>
            navigate("/attendance-ai")
          }
        >
          Back to AI Dashboard
        </button>

        <div className="ai-error">
          {error ||
            "AI risk not found."}
        </div>

      </div>
    );
  }

  const employee =
    risk.employee || {};

  const attendance =
    risk.attendance || {};

  return (
    <div className="attendance-ai-page">

      <div className="ai-page-header">

        <div>

          <button
            className="ai-back-button"
            onClick={() =>
              navigate("/attendance-ai")
            }
          >
            ← Back
          </button>

          <h1>
            AI Risk Analysis
          </h1>

          <p>
            {employee.name ||
              "Unknown Employee"}{" "}
            •{" "}
            {employee.employeeCode ||
              "-"}
          </p>

        </div>

        <AIRiskBadge
          level={risk.riskLevel}
        />

      </div>

      <div className="ai-detail-grid">

        <div className="ai-detail-card">

          <h2>
            Risk Score
          </h2>

          <AIRiskScore
            score={risk.riskScore}
            level={risk.riskLevel}
          />

        </div>

        <div className="ai-detail-card">

          <h2>
            Employee
          </h2>

          <div className="ai-info-row">
            <span>Name</span>
            <strong>
              {employee.name || "-"}
            </strong>
          </div>

          <div className="ai-info-row">
            <span>Employee Code</span>
            <strong>
              {employee.employeeCode ||
                "-"}
            </strong>
          </div>

          <div className="ai-info-row">
            <span>Department</span>
            <strong>
              {employee.department ||
                "-"}
            </strong>
          </div>

          <div className="ai-info-row">
            <span>Designation</span>
            <strong>
              {employee.designation ||
                "-"}
            </strong>
          </div>

        </div>

        <div className="ai-detail-card">

          <h2>
            Attendance
          </h2>

          <div className="ai-info-row">
            <span>Date</span>
            <strong>
              {attendance.date ||
                "-"}
            </strong>
          </div>

          <div className="ai-info-row">
            <span>Check In</span>
            <strong>
              {attendance.checkIn ||
                "-"}
            </strong>
          </div>

          <div className="ai-info-row">
            <span>Check Out</span>
            <strong>
              {attendance.checkOut ||
                "-"}
            </strong>
          </div>

        </div>

      </div>

      <div className="ai-detail-card">

        <h2>
          AI Findings
        </h2>

        {risk.findings?.length ? (
          <div className="ai-findings-list">

            {risk.findings.map(
              (finding, index) => (
                <AIFindingCard
                  key={index}
                  finding={finding}
                />
              )
            )}

          </div>
        ) : (
          <p>
            No specific findings were
            returned by the AI.
          </p>
        )}

      </div>

      <div className="ai-detail-card">

        <h2>
          AI Explanation
        </h2>

        <p className="ai-explanation">
          {risk.aiExplanation ||
            "No explanation available."}
        </p>

      </div>

      <div className="ai-detail-card">

        <h2>
          Recommended Action
        </h2>

        <p className="ai-explanation">
          {risk.recommendedAction ||
            "HR review recommended."}
        </p>

      </div>

      <div className="ai-detail-card">

        <h2>
          Review Status
        </h2>

        <div className="ai-current-status">
          {String(
            risk.status || "open"
          ).toUpperCase()}
        </div>

        <div className="ai-review-actions">

          <button
            disabled={actionLoading}
            onClick={() =>
              handleReview("reviewed")
            }
          >
            Mark Reviewed
          </button>

          <button
            disabled={actionLoading}
            onClick={() =>
              handleReview("dismissed")
            }
          >
            Dismiss
          </button>

          <button
            disabled={actionLoading}
            onClick={() =>
              handleReview("confirmed")
            }
          >
            Confirm
          </button>

        </div>

      </div>

    </div>
  );
};

export default AttendanceAiDetails;