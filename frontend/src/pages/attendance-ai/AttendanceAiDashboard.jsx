import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  getAIRisks,
  getAIRiskSummary,
} from "../../api/attendanceAiRiskApi";

import AIRiskStats from "../../components/attendance-ai/AIRiskStats";
import AIRiskTable from "../../components/attendance-ai/AIRiskTable";

import "./AttendanceAi.css";

const AttendanceAiDashboard = () => {
  const [risks, setRisks] = useState([]);
  const [summary, setSummary] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState({
    search: "",
    riskLevel: "",
    status: "",
  });

  const loadData = useCallback(
    async (showLoader = false) => {
      try {
        if (showLoader) {
          setRefreshing(true);
        }

        setError("");

        const params = {
          page: 1,
          limit: 100,
        };

        if (filters.search) {
          params.search = filters.search;
        }

        if (filters.riskLevel) {
          params.riskLevel = filters.riskLevel;
        }

        if (filters.status) {
          params.status = filters.status;
        }

        const [riskResponse, summaryResponse] =
          await Promise.all([
            getAIRisks(params),
            getAIRiskSummary(),
          ]);

        const riskData =
          riskResponse?.data?.risks ||
          riskResponse?.data ||
          [];

        const summaryData =
          summaryResponse?.data ||
          null;

        setRisks(
          Array.isArray(riskData)
            ? riskData
            : []
        );

        setSummary(summaryData);
      } catch (error) {
        console.error(
          "AI Attendance API Error:",
          error
        );

        setError(
          "Unable to load AI attendance analysis."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filters]
  );

  /*
   * Initial load + reload when filters change
   */
  useEffect(() => {
    loadData();
  }, [loadData]);

  /*
   * Automatic refresh every 30 seconds.
   *
   * Backend is responsible for AI generation.
   * Frontend only fetches the latest results.
   */
  useEffect(() => {
    const interval = setInterval(() => {
      loadData(false);
    }, 30000);

    return () => {
      clearInterval(interval);
    };
  }, [loadData]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;

    setFilters((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  if (loading) {
    return (
      <div className="attendance-ai-page">
        <div className="ai-loading">
          Loading AI attendance analysis...
        </div>
      </div>
    );
  }

  return (
    <div className="attendance-ai-page">

      <div className="ai-page-header">

        <div>
          <h1>
            AI Attendance Monitor
          </h1>

          <p>
            AI-powered employee attendance
            risk and anomaly detection
          </p>
        </div>

        <button
          className="ai-refresh-button"
          onClick={() => loadData(true)}
          disabled={refreshing}
        >
          {refreshing
            ? "Refreshing..."
            : "Refresh"}
        </button>

      </div>

      {error && (
        <div className="ai-error">
          <span>{error}</span>

          <button
            onClick={() => loadData(true)}
          >
            Retry
          </button>
        </div>
      )}

      <AIRiskStats summary={summary} />

      <div className="ai-filters">

        <input
          type="text"
          name="search"
          value={filters.search}
          onChange={handleFilterChange}
          placeholder="Search employee..."
        />

        <select
          name="riskLevel"
          value={filters.riskLevel}
          onChange={handleFilterChange}
        >
          <option value="">
            All Risk Levels
          </option>

          <option value="low">
            Low
          </option>

          <option value="medium">
            Medium
          </option>

          <option value="high">
            High
          </option>

          <option value="critical">
            Critical
          </option>
        </select>

        <select
          name="status"
          value={filters.status}
          onChange={handleFilterChange}
        >
          <option value="">
            All Status
          </option>

          <option value="open">
            Open
          </option>

          <option value="reviewed">
            Reviewed
          </option>

          <option value="dismissed">
            Dismissed
          </option>

          <option value="confirmed">
            Confirmed
          </option>
        </select>

      </div>

      {risks.length === 0 ? (
        <div className="ai-empty-state">

          <h3>
            No attendance anomalies detected
          </h3>

          <p>
            AI has not detected any attendance
            risks requiring review.
          </p>

        </div>
      ) : (
        <AIRiskTable risks={risks} />
      )}

    </div>
  );
};

export default AttendanceAiDashboard;