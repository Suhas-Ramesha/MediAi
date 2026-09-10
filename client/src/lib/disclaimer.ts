export function stripDiagnosisDisclaimer(text: string): string {
  return text
    .replace(
      /\n*This is not a medical diagnosis\. Please consult a certified doctor for professional advice\.?/gi,
      "",
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
