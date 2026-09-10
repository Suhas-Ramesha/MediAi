export function stripDiagnosisDisclaimer(text: string): string {
  return text
    .replace(
      /This is not a medical diagnosis\. Please consult a certified doctor for professional advice\.?/gi,
      "",
    )
    .replace(
      /Please consult (?:a|your) (?:certified )?doctor for professional advice\.?/gi,
      "",
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
