export type NextVisit = {
  when: string;
  doctorName?: string;
};

function asVisit(raw: unknown): NextVisit | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  const date = String(a.date || a.appointmentDate || "").trim();
  const time = String(a.time || a.startTime || "").trim();
  const doctorName = String(
    a.doctorName ||
      [a.firstName, a.lastName].filter(Boolean).join(" ") ||
      "",
  ).trim();
  const when = [date, time].filter(Boolean).join(" ");
  if (!when || when === "Unknown Date") return null;
  const t = Date.parse(date);
  if (Number.isFinite(t) && t + 86400000 < Date.now()) return null;
  return { when, doctorName: doctorName || undefined };
}

export function nextBookedVisit(): NextVisit | null {
  if (typeof localStorage === "undefined") return null;
  const candidates: unknown[] = [];
  try {
    const main = JSON.parse(localStorage.getItem("mediaiAppointments") || "[]");
    if (Array.isArray(main)) candidates.push(...main);
  } catch {
    /* ignore */
  }
  for (const key of Object.keys(localStorage)) {
    if (!/appointment|booking/i.test(key)) continue;
    try {
      const data = JSON.parse(localStorage.getItem(key) || "null");
      if (Array.isArray(data)) candidates.push(...data);
      else if (data && typeof data === "object") candidates.push(data);
    } catch {
      /* ignore */
    }
  }
  const visits = candidates
    .map(asVisit)
    .filter((v): v is NextVisit => Boolean(v));
  return visits[0] ?? null;
}
