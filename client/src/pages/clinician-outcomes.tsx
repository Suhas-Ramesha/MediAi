import { useEffect, useState } from "react";
import { Link } from "wouter";

import Header from "@/components/Header";
import { useAuth } from "@/hooks/use-auth";
import {
  day7Rate,
  matchedEffect,
  synthesizeConfoundedCohort,
} from "@shared/mediai/outcomes";

export default function ClinicianOutcomes() {
  const { currentUser } = useAuth();
  const [payload, setPayload] = useState<{
    day7: { rate: number; n: number; insufficient: boolean };
    effect: { estimate: number; nPairs: number; insufficient: boolean };
    source: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/mediai/outcomes/dashboard");
        if (!r.ok) throw new Error("api");
        const data = await r.json();
        if (!cancelled) setPayload({ ...data, source: "api" });
      } catch {
        const cohort = synthesizeConfoundedCohort(220, 3);
        if (!cancelled) {
          setPayload({
            day7: day7Rate(cohort),
            effect: matchedEffect(cohort, "drugA"),
            source: "fixture",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
          Patient-reported outcomes
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Aggregate only. Small samples show &quot;insufficient data&quot;
          instead of a precise percentage. This is not a ranking of doctors.
        </p>

        {payload && (
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <article className="surface p-6">
              <h2 className="text-sm font-semibold">Resolved by day 7</h2>
              {payload.day7.insufficient ? (
                <p className="mt-3 text-lg">Insufficient data</p>
              ) : (
                <p className="mt-3 text-4xl font-semibold" data-numeric>
                  {Math.round(payload.day7.rate * 100)}%
                </p>
              )}
              <p className="mt-2 text-sm text-muted-foreground">
                n = {payload.day7.n}
              </p>
            </article>
            <article className="surface p-6">
              <h2 className="text-sm font-semibold">
                Adjusted days-to-resolution (drug A vs matched controls)
              </h2>
              {payload.effect.insufficient ? (
                <p className="mt-3 text-lg">Insufficient data</p>
              ) : (
                <p className="mt-3 text-4xl font-semibold" data-numeric>
                  {payload.effect.estimate.toFixed(1)}
                </p>
              )}
              <p className="mt-2 text-sm text-muted-foreground">
                Pairs: {payload.effect.nPairs}. Negative means faster resolution
                after matching. Not proof of causality in real patients.
              </p>
            </article>
          </div>
        )}

        <p className="mt-6 text-xs text-muted-foreground">
          Source: {payload?.source ?? "loading"}. Synthetic cohort until a
          reviewed outcomes warehouse exists.
        </p>
        <Link href="/dashboard" className="mt-6 inline-block text-sm text-primary">
          Back to dashboard
        </Link>
      </main>
    </div>
  );
}
