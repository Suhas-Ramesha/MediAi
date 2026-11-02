import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileCheck,
  FileText,
  HelpCircle,
  Pencil,
  RefreshCw,
  Send,
  ShieldCheck,
  Stethoscope,
  UserCheck,
} from "lucide-react";

import { VisitPrepCard } from "@/components/VisitPrepCard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { saveBrief, takeStashedHandoff } from "@/lib/engineStore";
import {
  buildHandoffBrief,
  comePrepared,
  correctBrief,
  doctorMayView,
  markReviewed,
  type HandoffBrief,
} from "@shared/mediai/intake";
import { assertMappedSourcing } from "@shared/mediai/colloquial";

export default function HandoffReview() {
  const { currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const nextBook = useMemo(
    () => new URLSearchParams(window.location.search).get("next") === "book",
    [],
  );
  const [fragments, setFragments] = useState(
    "Been running a temp since yesterday\nmy throat is killing me\nthen I started throwing up",
  );
  const [meds, setMeds] = useState<string[]>([]);
  const [fromChat, setFromChat] = useState(false);
  const [brief, setBrief] = useState<HandoffBrief | null>(null);
  const [doctorPayload, setDoctorPayload] = useState<string>("");
  const [error, setError] = useState("");
  const [phrasing, setPhrasing] = useState(false);
  const [showEditWords, setShowEditWords] = useState(false);

  const prep = useMemo(
    () => comePrepared(fragments.replace(/\n/g, " ")),
    [fragments],
  );

  async function polish(next: HandoffBrief): Promise<HandoffBrief> {
    setPhrasing(true);
    try {
      const r = await fetch("/api/mediai/handoff/phrase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientWords: next.patientWords,
          engineDraft: next.synthesis,
          mappings: next.mappings.map((m) => m.clinical),
        }),
      });
      const data = await r.json().catch(() => ({}));
      const candidate = String(data.synthesis || "").trim();
      const source = String(data.source || "nlp");
      if (!candidate || candidate === next.synthesis) return next;
      if (data.source === "nlp" || data.source === "gemini") {
        return { ...next, synthesis: candidate, synthesisSource: source };
      }
      assertMappedSourcing(candidate, next.patientWords, next.mappings);
      return { ...next, synthesis: candidate, synthesisSource: source };
    } catch {
      return next;
    } finally {
      setPhrasing(false);
    }
  }

  useEffect(() => {
    const stashed = takeStashedHandoff();
    if (!stashed) return;
    setFragments(stashed.fragments.join("\n"));
    setMeds(stashed.medications);
    setFromChat(true);
    void (async () => {
      try {
        const next = buildHandoffBrief({
          fragments: stashed.fragments,
          medications: stashed.medications,
        });
        const polished = await polish(next);
        setBrief(polished);
        void saveBrief(currentUser?.uid ?? null, polished);
      } catch {
        setError("Could not build a brief with fully sourced statements.");
      }
    })();
  }, [currentUser?.uid]);

  const create = () => {
    setError("");
    setDoctorPayload("");
    void (async () => {
      try {
        const next = buildHandoffBrief({
          fragments: fragments.split("\n").map((s) => s.trim()).filter(Boolean),
          medications: meds,
        });
        const polished = await polish(next);
        setBrief(polished);
        void saveBrief(currentUser?.uid ?? null, polished);
      } catch {
        setError("Could not build a brief with fully sourced statements.");
      }
    })();
  };

  const applyEdits = () => {
    if (!brief) return;
    setError("");
    setDoctorPayload("");
    try {
      setBrief(
        correctBrief(
          brief,
          fragments.split("\n").map((s) => s.trim()).filter(Boolean),
        ),
      );
    } catch {
      setError("A correction that is not sourced from your words was refused.");
    }
  };

  const approve = () => {
    if (!brief) return;
    try {
      const next = markReviewed(brief, "approved");
      setBrief(next);
      void saveBrief(currentUser?.uid ?? null, next);
    } catch {
      setError("Review refused: a statement is still unsourced.");
    }
  };

  const waive = () => {
    if (!brief) return;
    try {
      const next = markReviewed(brief, "waived", "explicit patient waiver");
      setBrief(next);
      void saveBrief(currentUser?.uid ?? null, next);
    } catch {
      setError("Waiver refused: the brief still contains unsourced statements.");
    }
  };

  const tryDoctor = () => {
    if (!brief) return;
    if (!doctorMayView(brief)) {
      setDoctorPayload(
        "Blocked: the brief cannot reach a doctor-facing view without your review.",
      );
      return;
    }
    setDoctorPayload(
      `${brief.synthesis}\n\n${brief.triageSnapshot}`,
    );
  };

  return (
    <main className="container-page py-8 max-w-5xl">
      {/* Top back navigation and title */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Doctor Visit Brief
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Review and approve your clinical summary before sharing with your doctor.
          </p>
        </div>

        {/* Status Badge */}
        {brief && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Status:</span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
                brief.patientReview.status === "approved"
                  ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : brief.patientReview.status === "waived"
                  ? "border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "border border-border bg-muted text-muted-foreground"
              }`}
            >
              {brief.patientReview.status === "approved" && (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              {brief.patientReview.status}
            </span>
          </div>
        )}
      </div>

      {fromChat && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-2.5 text-xs text-primary">
          <FileCheck className="h-4 w-4 shrink-0" />
          <span>
            Loaded automatically from your conversation. Review the summary below and click <strong>"I approve this brief"</strong> to enable booking.
          </span>
        </div>
      )}

      {/* Prominent Action Bar (Placed immediately at the top - NO scrolling needed!) */}
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-border/80 bg-card p-3 shadow-xs">
        <Button
          onClick={create}
          disabled={phrasing}
          className="h-9 gap-1.5 rounded-lg px-4 text-xs font-semibold"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${phrasing ? "animate-spin" : ""}`} />
          {phrasing ? "Synthesizing…" : "Build / Regenerate brief"}
        </Button>

        <Button
          variant={brief?.patientReview.status === "approved" ? "default" : "outline"}
          onClick={approve}
          disabled={!brief}
          className={`h-9 gap-1.5 rounded-lg px-3.5 text-xs font-semibold ${
            brief?.patientReview.status === "approved"
              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
              : ""
          }`}
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          I approve this brief
        </Button>

        <Button
          variant="outline"
          onClick={waive}
          disabled={!brief}
          className="h-9 gap-1.5 rounded-lg px-3.5 text-xs"
        >
          <UserCheck className="h-3.5 w-3.5" />
          Waive review
        </Button>

        <Button
          variant="outline"
          onClick={tryDoctor}
          disabled={!brief}
          className="h-9 gap-1.5 rounded-lg px-3.5 text-xs"
        >
          <Stethoscope className="h-3.5 w-3.5" />
          Open doctor view
        </Button>

        <Button
          variant="ghost"
          onClick={() => setShowEditWords((prev) => !prev)}
          className="h-9 gap-1.5 rounded-lg px-3 text-xs text-muted-foreground hover:text-foreground ml-auto"
        >
          <Pencil className="h-3.5 w-3.5" />
          {showEditWords ? "Hide word editor" : "Edit symptoms"}
        </Button>

        {nextBook && brief && doctorMayView(brief) && (
          <Button
            onClick={() => setLocation("/dashboard?book=1")}
            className="h-9 gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 text-xs font-bold shadow-md animate-pulse ml-2"
          >
            Continue to book a slot
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Primary Brief Content (Directly visible at the top without scrolling) */}
      {brief ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-12 items-start">
          {/* Main Clinical Synthesis Column */}
          <div className="lg:col-span-7 space-y-4">
            <article className="surface p-5 sm:p-6 shadow-sm border border-border">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold tracking-tight">Clinical Synthesis</h2>
                </div>
                {brief.synthesisSource && (
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold text-primary uppercase tracking-wide">
                    {brief.synthesisSource === "nlp" ? "Local ML NLP" : brief.synthesisSource}
                  </span>
                )}
              </div>

              <div className="mt-4 rounded-lg bg-muted/40 p-4 text-sm leading-relaxed text-foreground">
                <p className="font-medium text-foreground/95">{brief.synthesis}</p>
              </div>

              {/* Mapped clinical entities */}
              {brief.mappings.length > 0 && (
                <div className="mt-4 space-y-2 border-t border-border/50 pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Clinical Mappings (Sourced)
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {brief.mappings.map((m) => (
                      <span
                        key={`${m.id}-${m.sourceSpan}`}
                        className="inline-flex items-center rounded-md border border-border/70 bg-card px-2.5 py-1 text-xs text-foreground/90 font-mono shadow-2xs"
                      >
                        <span className="text-muted-foreground mr-1.5">"{m.sourceSpan}"</span>
                        <ArrowRight className="h-3 w-3 text-primary mr-1.5" />
                        <span className="font-semibold text-primary">{m.clinical}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Triage snapshot */}
              {brief.triageSnapshot && (
                <div className="mt-4 rounded-lg border border-border/60 bg-background/50 p-3 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Triage Priority: </span>
                  {brief.triageSnapshot}
                </div>
              )}
            </article>

            {/* Doctor view preview if generated */}
            {doctorPayload && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-semibold text-primary mb-2">
                  <Stethoscope className="h-4 w-4" />
                  Doctor-Facing Payload Output
                </div>
                <p className="whitespace-pre-wrap font-mono text-xs text-foreground/90 leading-relaxed bg-background/80 p-3 rounded-lg border border-border/50">
                  {doctorPayload}
                </p>
              </div>
            )}
          </div>

          {/* Right Column: Patient Words & Visit Prep */}
          <div className="lg:col-span-5 space-y-4">
            <article className="surface p-5 shadow-sm border border-border">
              <h2 className="text-sm font-semibold tracking-tight border-b border-border/60 pb-2.5">
                Your Words (Transcribed)
              </h2>
              <ul className="mt-3 space-y-2 text-xs">
                {brief.patientWords.map((w, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 rounded-md bg-muted/30 p-2 text-foreground/90"
                  >
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </article>

            {/* Visit Prep (Compact advice for doctor visit) */}
            <VisitPrepCard prep={prep} />
          </div>
        </div>
      ) : (
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center bg-card/50">
          <FileText className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <h3 className="text-base font-semibold">No brief generated yet</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Click the "Build brief" button above to synthesize your symptoms into a verified physician handoff.
          </p>
          <Button onClick={create} disabled={phrasing} className="mt-4 text-xs">
            {phrasing ? "Building…" : "Build brief now"}
          </Button>
        </div>
      )}

      {/* Collapsible raw symptom edit area (neatly tucked away so it never forces scrolling) */}
      {showEditWords && (
        <div className="mt-6 surface p-5 border border-border">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-foreground">
              Edit Recorded Symptoms (one statement per line):
            </label>
            <Button size="sm" onClick={applyEdits} disabled={!brief} className="h-7 text-xs">
              Apply Edits
            </Button>
          </div>
          <textarea
            className="w-full rounded-lg border border-input bg-background p-3 text-xs font-mono leading-relaxed min-h-24"
            value={fragments}
            onChange={(e) => setFragments(e.target.value)}
            aria-label="Your words, one event per line"
          />
        </div>
      )}
    </main>
  );
}
