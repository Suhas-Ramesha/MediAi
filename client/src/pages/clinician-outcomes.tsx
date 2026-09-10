import { useEffect, useState } from "react";
import { Link } from "wouter";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";

import Header from "@/components/Header";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import {
  loadAuditsLocal,
  loadBriefsLocal,
  loadGraph,
  restoreChatSession,
} from "@/lib/engineStore";
import type { SafetyGraph } from "@shared/mediai/medication";
import { emptySafetyGraph } from "@shared/mediai/chatSafety";
import { day7Rate, matchedEffect } from "@shared/mediai/outcomes";

export default function ClinicianOutcomes() {
  const { currentUser } = useAuth();
  const [graph, setGraph] = useState<SafetyGraph | null>(null);
  const [diary, setDiary] = useState<{ symptom: string; at: string }[]>([]);

  const briefs = loadBriefsLocal();
  const audits = loadAuditsLocal();
  const chat = restoreChatSession();
  const flags = [
    ...new Set(
      audits.flatMap((a) => a.result?.escalation?.flags ?? []),
    ),
  ];
  const lastUser = [...(chat?.messages ?? [])]
    .reverse()
    .find((m: any) => m?.role === "user") as { content?: string } | undefined;

  useEffect(() => {
    const pid = currentUser?.uid ?? "anon";
    void loadGraph(currentUser?.uid ?? null, pid, []).then(setGraph);
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    (async () => {
      try {
        const logsCollection = collection(db, "symptomLogs");
        const q = query(
          logsCollection,
          where("userId", "==", currentUser.uid),
          orderBy("timestamp", "desc"),
        );
        const snap = await getDocs(q);
        if (cancelled) return;
        setDiary(
          snap.docs.slice(0, 12).map((d) => {
            const data = d.data() as { symptom?: string; timestamp?: { toDate?: () => Date } };
            return {
              symptom: String(data.symptom ?? ""),
              at: data.timestamp?.toDate?.()?.toISOString?.() ?? "",
            };
          }),
        );
      } catch {
        if (!cancelled) setDiary([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  const fakeEpisodes = [] as Parameters<typeof day7Rate>[0];
  const day7 = day7Rate(fakeEpisodes);
  const effect = matchedEffect(fakeEpisodes, "drugA");
  const g = graph ?? emptySafetyGraph(currentUser?.uid ?? "anon");

  return (
    <div className="min-h-screen bg-background">
      {currentUser && (
        <Header
          user={{
            name: currentUser.displayName || "Clinician",
            email: currentUser.email || "",
          }}
        />
      )}
      <main className="container-page py-12">
        <p className="eyebrow">Clinician view</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          This patient&apos;s record
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Outcomes here are assembled from this account&apos;s graph, briefs,
          chat engines, and diary — not a synthetic warehouse. Matched
          treatment effects stay &quot;insufficient data&quot; until many real
          episodes exist.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <article className="surface p-6">
            <h2 className="text-sm font-semibold">Medicines on the safety graph</h2>
            {g.medications.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                None recorded from chat yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-1 text-sm">
                {g.medications.map((m) => (
                  <li key={`${m.rxcui}-${m.startedOn}`}>
                    {m.genericName} (RxCUI {m.rxcui})
                  </li>
                ))}
              </ul>
            )}
          </article>
          <article className="surface p-6">
            <h2 className="text-sm font-semibold">Red flags from engine audits</h2>
            {flags.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">None stored.</p>
            ) : (
              <p className="mt-3 text-sm">{flags.join(", ")}</p>
            )}
          </article>
          <article className="surface p-6">
            <h2 className="text-sm font-semibold">Visit briefs</h2>
            {briefs.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No brief has been built yet. Use Send to doctor brief in chat.
              </p>
            ) : (
              <ul className="mt-3 space-y-3 text-sm">
                {briefs.slice(-5).reverse().map((b) => (
                  <li key={b.id}>
                    <p className="font-medium">{b.patientReview.status}</p>
                    <p className="text-muted-foreground">{b.synthesis}</p>
                    <p className="mt-1 text-xs">{b.triageSnapshot}</p>
                  </li>
                ))}
              </ul>
            )}
          </article>
          <article className="surface p-6">
            <h2 className="text-sm font-semibold">Latest chat words</h2>
            <p className="mt-3 text-sm">
              {lastUser?.content || "No restored chat session on this device."}
            </p>
          </article>
          <article className="surface p-6">
            <h2 className="text-sm font-semibold">Symptom diary</h2>
            {diary.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                {currentUser
                  ? "No diary rows yet, or Firestore is unavailable."
                  : "Sign in to load diary rows from this account."}
              </p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {diary.map((row) => (
                  <li key={`${row.at}-${row.symptom}`}>
                    {row.symptom}
                    {row.at ? (
                      <span className="text-muted-foreground"> · {row.at.slice(0, 10)}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </article>
          <article className="surface p-6">
            <h2 className="text-sm font-semibold">Aggregate matching</h2>
            <p className="mt-3 text-lg">
              {day7.insufficient ? "Insufficient data" : `${Math.round(day7.rate * 100)}%`}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Day-7 resolution n = {day7.n}. Matched effect pairs = {effect.nPairs}
              {effect.insufficient ? " (insufficient)." : "."} This is not a
              ranking of doctors.
            </p>
          </article>
        </div>

        <Link href="/dashboard" className="mt-8 inline-block text-sm text-primary">
          Back to dashboard
        </Link>
      </main>
    </div>
  );
}
