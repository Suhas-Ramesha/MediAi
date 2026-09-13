import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

import Header from "@/components/Header";
import { SymptomBodyMap } from "@/components/SymptomBodyMap";
import { VisitPrepCard } from "@/components/VisitPrepCard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { restoreChatSession } from "@/lib/engineStore";
import { nextBookedVisit } from "@/lib/nextVisit";
import { mapTranscriptToBody } from "@shared/mediai/bodyMap";
import { comePrepared } from "@shared/mediai/intake";

export default function BodyMapPage() {
  const { currentUser } = useAuth();
  const [text, setText] = useState(
    "I have a headache since yesterday. Light hurts. Appointment thoughts?",
  );
  const [selected, setSelected] = useState<string | undefined>("head");
  const visit = useMemo(() => nextBookedVisit(), []);

  useEffect(() => {
    const saved = restoreChatSession();
    if (!saved?.messages?.length) return;
    const lines = saved.messages
      .filter((m: { role?: string; content?: string }) => m.role === "user" && m.content)
      .map((m: { content?: string }) => String(m.content).trim())
      .filter(Boolean);
    if (lines.length) setText(lines.join("\n"));
  }, []);

  const map = useMemo(() => mapTranscriptToBody(text, visit), [text, visit]);
  const prep = useMemo(() => comePrepared(text), [text]);

  useEffect(() => {
    if (!map.hits.some((h) => h.regionId === selected)) {
      setSelected(map.hits[0]?.regionId);
    }
  }, [map, selected]);

  return (
    <div className="min-h-screen bg-background">
      {currentUser && (
        <Header
          user={{
            name: currentUser.displayName || "You",
            email: currentUser.email || "",
          }}
        />
      )}
      <main className="container-page py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Where it sits</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          An outline of the sites you named, when they started, and the next
          booked slot. Related questions are what a doctor often asks next —
          not extra diagnoses, and not tests to buy beforehand.
        </p>

        <textarea
          className="mt-6 min-h-28 w-full rounded-xl border border-input bg-background p-3 text-sm"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Your words"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setText("Sudden chest pain this morning, it goes into my left arm.")
            }
          >
            Chest example
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setText("Fever since yesterday and my throat is killing me.")
            }
          >
            Throat example
          </Button>
        </div>

        <div className="mt-8 surface p-5">
          <SymptomBodyMap
            map={map}
            selectedId={selected}
            onSelect={setSelected}
          />
        </div>

        <div className="mt-6">
          <VisitPrepCard prep={prep} />
        </div>

        <Link href="/dashboard" className="mt-8 inline-block text-sm text-primary">
          Back to dashboard
        </Link>
      </main>
    </div>
  );
}
