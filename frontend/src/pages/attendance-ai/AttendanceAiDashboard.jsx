import React, { useCallback, useEffect, useState } from "react";

import { useNavigate } from "react-router-dom";
import {
  getAIRisks,
  getAIRiskSummary,
  runAIRiskAnalysis,
} from "../../api/attendanceAiRiskApi";

import AIRiskStats from "../../components/attendance-ai/AIRiskStats";
import AIRiskTable from "../../components/attendance-ai/AIRiskTable";

import "./AttendanceAi.css";

const AttendanceAiDashboard = () => {
  const navigate = useNavigate();

  const [risks, setRisks] = useState([]);
  const [summary, setSummary] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // "Run AI analysis"
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisDays, setAnalysisDays] = useState(30);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisError, setAnalysisError] = useState("");

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

        const [riskResponse, summaryResponse] = await Promise.all([
          getAIRisks(params),
          getAIRiskSummary(),
        ]);

        const riskData = riskResponse?.data?.risks || riskResponse?.data || [];

        const summaryData = summaryResponse?.data || null;

        setRisks(Array.isArray(riskData) ? riskData : []);

        setSummary(summaryData);
      } catch (error) {
        console.error("AI Attendance API Error:", error);

        setError("Unable to load AI attendance analysis.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filters],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadData(false);
    }, 30000);

    return () => {
      clearInterval(interval);
    };
  }, [loadData]);

  const handleRunAnalysis = async () => {
    try {
      setAnalyzing(true);
      setAnalysisError("");
      setAnalysisResult(null);

      const response = await runAIRiskAnalysis({ days: analysisDays });

      setAnalysisResult(response?.data || null);

      await loadData(false);
    } catch (error) {
      console.error("AI analysis error:", error);

      setAnalysisError(
        error?.response?.data?.message ||
          "The AI analysis could not be completed. Please try again.",
      );
    } finally {
      setAnalyzing(false);
    }
  };

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
        <div className="ai-loading">Loading AI attendance analysis...</div>
      </div>
    );
  }

  return (
    <div className="attendance-ai-page">
      <div className="ai-page-header">
        <div>
          <h1>AI Attendance Monitor</h1>

          <p>AI-powered employee attendance risk and anomaly detection</p>
        </div>

        <div className="ai-header-actions">
          <button
            type="button"
            className="ai-back-button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <span className="ai-back-icon">‹</span>
            <span>Back</span>
          </button>

          <select
            className="ai-days-select"
            value={analysisDays}
            onChange={(event) => setAnalysisDays(Number(event.target.value))}
            disabled={analyzing}
            aria-label="Analysis period"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
          </select>

          <button
            type="button"
            className="ai-run-button"
            onClick={handleRunAnalysis}
            disabled={analyzing}
          >
            {analyzing ? "Analysing..." : "Run AI analysis"}
          </button>

          <button
            type="button"
            className="ai-refresh-button"
            onClick={() => loadData(true)}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="ai-error">
          <span>{error}</span>

          <button onClick={() => loadData(true)}>Retry</button>
        </div>
      )}

      {analysisError && (
        <div className="ai-error">
          <span>{analysisError}</span>

          <button onClick={() => setAnalysisError("")}>Dismiss</button>
        </div>
      )}

      {analysisResult && (
        <div className="ai-run-banner">
          <span>
            Analysed <strong>{analysisResult.analyzed}</strong> of{" "}
            {analysisResult.employees} employee(s) over the last{" "}
            {analysisResult.days} days:{" "}
            {analysisResult.flagged ? (
              <>
                <strong>{analysisResult.flagged}</strong> with unusual patterns
                ({analysisResult.created} new, {analysisResult.updated} updated
                {analysisResult.skipped
                  ? `, ${analysisResult.skipped} already reviewed`
                  : ""}
                ).
              </>
            ) : (
              "no unusual patterns found."
            )}
            {analysisResult.failed
              ? ` ${analysisResult.failed} could not be analysed.`
              : ""}
          </span>

          <button onClick={() => setAnalysisResult(null)}>Dismiss</button>
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
          <option value="">All Risk Levels</option>

          <option value="low">Low</option>

          <option value="medium">Medium</option>

          <option value="high">High</option>

          <option value="critical">Critical</option>
        </select>

        <select
          name="status"
          value={filters.status}
          onChange={handleFilterChange}
        >
          <option value="">All Status</option>

          <option value="open">Open</option>

          <option value="reviewed">Reviewed</option>

          <option value="dismissed">Dismissed</option>

          <option value="confirmed">Confirmed</option>
        </select>
      </div>

      {risks.length === 0 ? (
        <div className="ai-empty-state">
          <h3>No attendance anomalies detected</h3>

          <p>
            {analysisResult || summary?.total
              ? "AI has not detected any attendance risks requiring review."
              : "No analysis has produced results yet. Press Run AI analysis to scan the recent attendance of every employee."}
          </p>
        </div>
      ) : (
        <AIRiskTable risks={risks} />
      )}
    </div>
  );
};

export default AttendanceAiDashboard;