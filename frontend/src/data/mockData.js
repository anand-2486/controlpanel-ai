export const mockAnalysis = {
    response:
      "Employees are entitled to 24 annual leaves per year. The HR manager's contact number is [REDACTED] and salary is ₹12,00,000 per annum.",
  
    riskScores: {
      privacy: 0.92,
      hallucination: 0.85,
      bias: 0.10,
      security: 0.20,
    },
  
    overallRisk: 0.72,
  
    decision: "BLOCK",
  
    reasons: [
      "PII detected: Phone number",
      "PII detected: Salary information",
      "HR Strict policy prohibits disclosure of personal and financial data",
    ],
  
    evidence: {
      source: "hr_policy.txt",
      description:
        "HR policy prohibits sharing of employee contact details and compensation information.",
    },
  }