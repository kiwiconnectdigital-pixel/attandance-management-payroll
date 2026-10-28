const axios = require("axios");

// Optional: an Ollama model on this machine. Nothing here is required for the
// AI Attendance Monitor to work - without Ollama the rule-based explanation is used.
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434/api/chat";

const MODEL = process.env.OLLAMA_MODEL || "llama3.2:latest";

const analyzeAttendance = async (data) => {
  const prompt = `
You are an AI attendance anomaly detection system.

Analyze the employee attendance information below.

Your job is NOT to accuse the employee of fraud.

Identify unusual behavioral patterns and explain why HR
may want to review them.

Employee Data:
${JSON.stringify(data, null, 2)}

Return ONLY valid JSON in this format:

{
  "riskScore": 0,
  "riskLevel": "low",
  "findings": [],
  "explanation": "",
  "recommendedAction": ""
}

Risk levels:
0-29 = low
30-59 = medium
60-79 = high
80-100 = critical

Possible findings:

- unusual_checkin_pattern
- repeated_late_arrivals
- suspicious_attendance
- multiple_employees_same_device
- impossible_gps_movement
- frequent_location_changes
- unusual_overtime
- possible_attendance_manipulation

Do not invent facts.
Only use the information provided.
`;

  const response = await axios.post(
    OLLAMA_URL,
    {
      model: MODEL,

      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],

      stream: false,

      format: "json",
    },
    {
      timeout: 120000,
    },
  );

  return JSON.parse(response.data.message.content);
};

/**
 * Asks the local model to re-word findings that the rule engine already
 * produced. The model cannot change the findings or the score - it only
 * writes a friendlier explanation and next step for HR.
 * Throws if Ollama is not reachable; returns null for an unusable answer.
 */
const explainFindings = async ({
  employeeName,
  riskScore,
  riskLevel,
  findings,
  windowDays,
}) => {
  const facts = findings.map((finding) => ({
    type: finding.type,
    severity: finding.severity,
    fact: finding.explanation,
  }));

  const prompt = `
You are helping an HR manager understand an attendance report.

Employee: ${employeeName}
Period: last ${windowDays} days
Risk level: ${riskLevel} (${riskScore}/100)

Findings (these are facts from the attendance system):
${JSON.stringify(facts, null, 2)}

Write a short, neutral explanation (2 to 4 sentences) of what the findings
mean for HR, and one sentence with a sensible next step.
Use ONLY the facts above. Do not accuse the employee and do not invent anything.

Return ONLY valid JSON:
{"explanation": "", "recommendedAction": ""}
`;

  const response = await axios.post(
    OLLAMA_URL,
    {
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      stream: false,
      format: "json",
    },
    { timeout: 20000 },
  );

  const parsed = JSON.parse(response.data.message.content);

  const explanation = String(parsed.explanation || "").trim();
  const recommendedAction = String(parsed.recommendedAction || "").trim();

  if (!explanation || !recommendedAction) return null;

  return {
    explanation: explanation.slice(0, 1500),
    recommendedAction: recommendedAction.slice(0, 500),
    model: MODEL,
  };
};

module.exports = {
  analyzeAttendance,
  explainFindings,
  MODEL,
};