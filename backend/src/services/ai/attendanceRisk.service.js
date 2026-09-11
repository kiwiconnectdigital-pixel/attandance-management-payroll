const axios = require("axios");

const OLLAMA_URL = "http://localhost:11434/api/chat";

const MODEL = "qwen3:4b";

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
          content: prompt
        }
      ],

      stream: false,

      format: "json"
    },
    {
      timeout: 120000
    }
  );

  return JSON.parse(
    response.data.message.content
  );
};

module.exports = {
  analyzeAttendance
};