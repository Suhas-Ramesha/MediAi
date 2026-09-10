import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion, useReducedMotion } from "framer-motion";

import { Slider } from "@/components/ui/slider";
import {
  counterfactuals,
  projectCurve,
  type RiskInputs,
} from "@shared/mediai/risk";

const BASE: RiskInputs = {
  fastingGlucose: 142,
  bmi: 31.4,
  age: 46,
  systolic: 138,
  familyHistory: true,
};

export function RiskSimulatorDemo() {
  const reduce = useReducedMotion();
  const [bmi, setBmi] = useState(31.4);
  const curve = useMemo(() => projectCurve({ ...BASE, bmi }, 5, 0), [bmi]);
  const cfs = useMemo(() => counterfactuals({ ...BASE, bmi }, 42), [bmi]);
  const top = cfs[0];

  return (
    <div className="surface-raised p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm font-semibold">Projected risk if BMI stays at {bmi.toFixed(1)}</p>
        <p className="text-xs text-muted-foreground">Local projection surface</p>
      </div>
      <div className="mt-4 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={curve} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="year" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="diabetes"
              stroke="hsl(var(--primary))"
              dot={false}
              isAnimationActive={!reduce}
            />
            <Line
              type="monotone"
              dataKey="heart"
              stroke="hsl(var(--foreground))"
              dot={false}
              isAnimationActive={!reduce}
            />
            <Line
              type="monotone"
              dataKey="kidney"
              stroke="hsl(var(--warning))"
              dot={false}
              isAnimationActive={!reduce}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <label className="mt-4 block text-sm" htmlFor="bmi-slider">
        BMI
        <Slider
          id="bmi-slider"
          className="mt-3"
          min={22}
          max={40}
          step={0.1}
          value={[bmi]}
          onValueChange={(v) => setBmi(v[0] ?? bmi)}
          aria-label="BMI"
        />
      </label>
      {top && (
        <motion.p
          className="mt-4 text-sm text-muted-foreground"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          Smallest effective change: {top.description} - projected to lower
          diabetes risk more than any single other change, out of {cfs.length}{" "}
          evaluated.
        </motion.p>
      )}
    </div>
  );
}
