import { useMemo } from "react";
import { useSystem } from "../api/hooks";
import type { Sample } from "../types";
import { useLive } from "./live";

/** Plausible placeholder series shown until the API has collected real samples. */
export function sampleSeries(n = 60, now = Date.now()): Sample[] {
  const total = 8 * 1024 ** 3;
  return Array.from({ length: n }, (_, i) => {
    const t = now - (n - 1 - i) * 5000;
    const wave = Math.sin(i / 6) * 8 + Math.sin(i / 2.3) * 3;
    return {
      t,
      cpu: Math.max(2, 18 + wave + (i % 17 === 0 ? 25 : 0)),
      memUsed: total * (0.42 + Math.sin(i / 14) * 0.04),
      memTotal: total,
      load1: 0.6 + Math.abs(wave) / 20,
      containersRunning: 7,
    };
  });
}

/** REST history merged with live socket samples; falls back to sample data. */
export function useMetrics(): { series: Sample[]; sample: boolean } {
  const { data } = useSystem();
  const { metrics } = useLive();
  return useMemo(() => {
    const merged = [...(data?.history ?? [])];
    const last = merged.at(-1)?.t ?? 0;
    for (const m of metrics) if (m.t > last) merged.push(m);
    const series = merged.slice(-180);
    if (series.length >= 3) return { series, sample: false };
    return { series: sampleSeries(), sample: true };
  }, [data, metrics]);
}
