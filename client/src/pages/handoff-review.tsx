import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";

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
      if (!candidate || candidate === next.synthesis) return next;
      assertMappedSourcing(candidate, next.patientWords, next.mappings);
      return { ...next, synthesis: candidate };
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
    <main className="container-page py-12">
      <p className="eyebrow">Patient gate</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Review the brief before it is sent
      </h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Your own words stay visible next to a sourced clinical picture. Repeated
        chat lines are dropped. Ranking comes from the triage engine, not a
        hardcoded percentage.
      </p>
      {fromChat && (
        <p className="mt-3 text-sm text-primary">
          Loaded from your chat. Review the synthesis, then approve before a
          doctor can see it.
        </p>
      )}

      <textarea
        className="mt-6 min-h-32 w-full rounded-xl border border-input bg-background p-3 text-sm"
        value={fragments}
        onChange={(e) => setFragments(e.target.value)}
        aria-label="Your words, one event per line"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={create} disabled={phrasing}>
          {phrasing ? "Phrasing…" : "Build brief"}
        </Button>
        <Button variant="outline" onClick={applyEdits} disabled={!brief}>
          Save corrections
        </Button>
        <Button variant="outline" onClick={approve} disabled={!brief}>
          I approve this brief
        </Button>
        <Button variant="outline" onClick={waive} disabled={!brief}>
          Waive review
        </Button>
        <Button variant="outline" onClick={tryDoctor} disabled={!brief}>
          Open doctor view
        </Button>
        {nextBook && brief && doctorMayView(brief) && (
          <Button onClick={() => setLocation("/dashboard?book=1")}>
            Continue to book a slot
          </Button>
        )}
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <article className="mt-6 surface p-5">
        <h2 className="text-sm font-semibold">Come prepared</h2>
        <p className="mt-2 text-sm">{prep.guideline}</p>
        {prep.labs.length > 0 && (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {prep.labs.map((lab) => (
              <li key={lab}>{lab}</li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Fasting required: {prep.fasting ? "yes" : "no"}. Status: {prep.state.replace(/_/g, " ")}.
        </p>
      </article>

      {brief && (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <article className="surface p-5">
            <h2 className="text-sm font-semibold">Your words</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {brief.patientWords.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </article>
          <article className="surface p-5">
            <h2 className="text-sm font-semibold">Clinical synthesis</h2>
            <p className="mt-3 text-sm">{brief.synthesis}</p>
            {brief.mappings.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {brief.mappings.map((m) => (
                  <li key={`${m.id}-${m.sourceSpan}`}>
                    &quot;{m.sourceSpan}&quot; → {m.clinical}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              {brief.triageSnapshot}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Review status: {brief.patientReview.status}
            </p>
          </article>
        </div>
      )}

      {doctorPayload && (
        <p className="mt-6 whitespace-pre-wrap rounded-xl border border-border bg-muted/40 p-4 text-sm">
          {doctorPayload}
        </p>
      )}

      <Link href="/dashboard" className="mt-8 inline-block text-sm text-primary">
        Back
      </Link>
    </main>
  );
}
