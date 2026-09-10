import { useState } from "react";
import { Link } from "wouter";

import { Button } from "@/components/ui/button";
import {
  buildHandoffBrief,
  correctBrief,
  doctorMayView,
  markReviewed,
  type HandoffBrief,
} from "@shared/mediai/intake";

export default function HandoffReview() {
  const [fragments, setFragments] = useState(
    "Been running a temp since yesterday\nmy throat is killing me\nthen I started throwing up",
  );
  const [brief, setBrief] = useState<HandoffBrief | null>(null);
  const [doctorPayload, setDoctorPayload] = useState<string>("");
  const [error, setError] = useState("");

  const create = () => {
    setError("");
    setDoctorPayload("");
    try {
      const next = buildHandoffBrief({
        fragments: fragments.split("\n").map((s) => s.trim()).filter(Boolean),
        medications: [],
        differential: [{ condition: "viral_uri", probability: 0.48 }],
      });
      setBrief(next);
    } catch {
      setError("Could not build a brief with fully sourced statements.");
    }
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
      setBrief(markReviewed(brief, "approved"));
    } catch {
      setError("Review refused: a statement is still unsourced.");
    }
  };

  const waive = () => {
    if (!brief) return;
    try {
      setBrief(markReviewed(brief, "waived", "explicit patient waiver"));
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
        Your own words stay visible next to the clinical picture. Colloquial
        phrases are translated only when a sourced map matches them. Nothing is
        sent to a doctor until you approve it, or explicitly waive review.
      </p>

      <textarea
        className="mt-6 min-h-32 w-full rounded-xl border border-input bg-background p-3 text-sm"
        value={fragments}
        onChange={(e) => setFragments(e.target.value)}
        aria-label="Your words, one event per line"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={create}>Build brief</Button>
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
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

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

      <Link href="/" className="mt-8 inline-block text-sm text-primary">
        Back
      </Link>
    </main>
  );
}
