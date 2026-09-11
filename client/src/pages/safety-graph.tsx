import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { loadGraph, saveGraph } from "@/lib/engineStore";
import { emptySafetyGraph } from "@shared/mediai/chatSafety";
import {
  auditGraph,
  doctorsFor,
  parsePrescriptionText,
  removeFromGraph,
  mergeIntoGraph,
  sideEffectWatch,
  type AuditResult,
  type SafetyGraph,
} from "@shared/mediai/medication";

type PreviewResponse = {
  graph: SafetyGraph;
  unknownTokens: string[];
  entries: { rxcui: string; genericName: string; rawText: string }[];
  audit: AuditResult;
};

export default function SafetyGraphPage() {
  const { currentUser, userProfile } = useAuth();
  const [graph, setGraph] = useState<SafetyGraph>(() => emptySafetyGraph("anon"));
  const [doctorId, setDoctorId] = useState("");
  const [startedOn, setStartedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [symptom, setSymptom] = useState("");

  const allergies = useMemo(
    () =>
      String(userProfile?.allergies ?? "")
        .split(/[,;/]/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    [userProfile?.allergies],
  );

  useEffect(() => {
    const pid = currentUser?.uid ?? "anon";
    void loadGraph(currentUser?.uid ?? null, pid, allergies).then((g) => {
      setGraph({ ...g, allergies: g.allergies.length ? g.allergies : allergies });
    });
  }, [currentUser?.uid, allergies]);

  const liveAudit = useMemo(() => auditGraph(graph), [graph]);
  const watch = useMemo(
    () =>
      symptom.trim()
        ? sideEffectWatch(graph, symptom, new Date().toISOString().slice(0, 10))
        : { matches: [] },
    [graph, symptom],
  );

  const persist = (next: SafetyGraph) => {
    setGraph(next);
    void saveGraph(currentUser?.uid ?? null, next);
  };

  const runPreview = async () => {
    setError("");
    setPreview(null);
    const doctor = doctorId.trim() || "unspecified-clinic";
    const local = parsePrescriptionText(text, doctor, startedOn);
    if (!text.trim()) {
      setError("Paste the medicine names from that visit.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/mediai/medication/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          graph,
          doctorId: doctor,
          startedOn,
          text,
        }),
      });
      if (r.ok) {
        setPreview((await r.json()) as PreviewResponse);
      } else {
        const merged = mergeIntoGraph(graph, local.entries);
        setPreview({
          graph: merged.graph,
          unknownTokens: local.unknownTokens,
          entries: local.entries,
          audit: auditGraph(merged.graph),
        });
      }
    } catch {
      const merged = mergeIntoGraph(graph, local.entries);
      setPreview({
        graph: merged.graph,
        unknownTokens: local.unknownTokens,
        entries: local.entries,
        audit: auditGraph(merged.graph),
      });
    } finally {
      setBusy(false);
    }
  };

  const confirmAdd = () => {
    if (!preview) return;
    if (!preview.entries.length) {
      setError("No token resolved to a RxNorm CUI. Nothing was added.");
      return;
    }
    persist(preview.graph);
    setPreview(null);
    setText("");
  };

  return (
    <div className="min-h-screen bg-background">
      {currentUser && (
        <Header
          user={{
            name: currentUser.displayName || userProfile?.name || "You",
            email: currentUser.email || "",
          }}
        />
      )}
      <main className="container-page py-12">
        <p className="eyebrow">Cross-doctor list</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          My medicines
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          This list belongs to you, not to one clinic. Add what another doctor
          prescribed and the engine checks it against what is already here.
          Unknown names stay incomplete. This is not a signed prescription pad.
        </p>

        {liveAudit.status !== "clear" && (
          <div className="mt-6 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
            <p className="font-medium">Current list</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {liveAudit.findings.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <article className="surface p-5">
            <h2 className="text-sm font-semibold">On this list</h2>
            {graph.medications.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Empty. Chat mentions or an outside prescription will appear here.
              </p>
            ) : (
              <ul className="mt-3 space-y-3 text-sm">
                {graph.medications.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0"
                  >
                    <div>
                      <p className="font-medium">{m.genericName}</p>
                      <p className="text-xs text-muted-foreground">
                        RxCUI {m.rxcui}
                        {m.dose ? ` · ${m.dose}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Doctors: {doctorsFor(m).join(", ")}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => persist(removeFromGraph(graph, m.rxcui))}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {graph.allergies.length > 0 && (
              <p className="mt-4 text-xs text-muted-foreground">
                Allergies on file: {graph.allergies.join(", ")}
              </p>
            )}
          </article>

          <article className="surface p-5">
            <h2 className="text-sm font-semibold">Add from another doctor</h2>
            <p className="mt-2 text-xs text-muted-foreground">
              Type names, one per line. Photo-to-pill guessing is not used.
            </p>
            <label className="mt-4 block text-xs font-medium">Doctor or clinic</label>
            <input
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              placeholder="e.g. City GP / Dr Rao"
            />
            <label className="mt-3 block text-xs font-medium">Started on</label>
            <input
              type="date"
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              value={startedOn}
              onChange={(e) => setStartedOn(e.target.value)}
            />
            <label className="mt-3 block text-xs font-medium">Medicines named</label>
            <textarea
              className="mt-1 min-h-28 w-full rounded-xl border border-input bg-background p-3 text-sm"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="warfarin 5mg&#10;ibuprofen 400mg"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => void runPreview()} disabled={busy}>
                {busy ? "Checking…" : "Check against my list"}
              </Button>
              <Button
                variant="outline"
                onClick={confirmAdd}
                disabled={!preview || preview.entries.length === 0}
              >
                Add resolved names
              </Button>
            </div>
            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
            {preview && (
              <div className="mt-4 space-y-2 text-sm">
                {preview.entries.length > 0 && (
                  <ul className="space-y-1">
                    {preview.entries.map((e) => (
                      <li key={`${e.rxcui}-${e.rawText}`}>
                        {e.genericName} · RxCUI {e.rxcui}
                      </li>
                    ))}
                  </ul>
                )}
                {preview.unknownTokens.length > 0 && (
                  <p className="text-destructive">
                    Unresolved (not added): {preview.unknownTokens.join("; ")}
                  </p>
                )}
                {preview.audit.status !== "clear" && (
                  <ul className="rounded-md border border-warning/40 bg-warning/10 p-2 text-xs">
                    {preview.audit.findings.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                )}
                {preview.audit.status === "clear" && preview.entries.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    No listed pair fired on this curated table. That is not an
                    all-clear for unlisted combinations.
                  </p>
                )}
              </div>
            )}
          </article>
        </div>

        <article className="mt-6 surface p-5">
          <h2 className="text-sm font-semibold">Symptom vs listed medicines</h2>
          <p className="mt-2 text-xs text-muted-foreground">
            Checks a short published onset window (for example metformin and
            diarrhea). Misses stay quiet rather than inventing a link.
          </p>
          <input
            className="mt-3 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            value={symptom}
            onChange={(e) => setSymptom(e.target.value)}
            placeholder="e.g. watery diarrhea since this morning"
          />
          {watch.matches.length > 0 ? (
            <ul className="mt-3 space-y-1 text-sm">
              {watch.matches.map((m) => (
                <li key={`${m.drug}-${m.effect}`}>
                  {m.drug} is listed for {m.effect} around day {m.daysSinceStart}.
                </li>
              ))}
            </ul>
          ) : (
            symptom.trim() && (
              <p className="mt-3 text-sm text-muted-foreground">
                No listed onset window matched.
              </p>
            )
          )}
        </article>

        <p className="mt-6 text-xs text-muted-foreground">
          Healthplix-style clinic EMRs keep a file per practice. This page is
          the opposite: one patient list, many doctors tagged on each RxCUI.
        </p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-primary">
          Back to dashboard
        </Link>
      </main>
    </div>
  );
}
