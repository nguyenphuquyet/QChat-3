/**
 * Performance measurement contract (specification section 9.1).
 *
 * The method is fixed before any number is measured, so a measurement cannot
 * pick a friendlier definition afterwards. Every sample is reported with the
 * device, OS and WebView versions; a missed target is reported as a number.
 */

export const PERFORMANCE_VERSION = 1 as const;

export const METRIC_IDS = [
  "coldStart",
  "warmStart",
  "setDataToPaint",
  "scroll500",
  "memoryPeak",
  "install2MB",
] as const;

export type MetricId = (typeof METRIC_IDS)[number];

export interface MetricDefinition {
  id: MetricId;
  label: string;
  unit: "ms" | "fps" | "MB";
  /** Comparison used against the target. */
  comparison: "max" | "min";
  /** Which value is compared: the median of the samples or the peak. */
  aggregate: "median" | "peak";
  /** Confirmed target from the M0 plan. */
  target: number;
  /** Extra rule from section 9.1, when the metric has one. */
  note: string;
  /** How the value is produced. */
  method: string;
}

export const METRICS: readonly MetricDefinition[] = [
  {
    id: "coldStart",
    label: "Cold start: entry tap to first page rendered",
    unit: "ms",
    comparison: "max",
    aggregate: "median",
    target: 2500,
    note: "Package installed, runtime not loaded.",
    method: "Host timestamp at entry tap minus the first `page.ready` paint acknowledgement from the View Runtime; median of 10 launches after a forced runtime unload.",
  },
  {
    id: "warmStart",
    label: "Warm start: entry tap to first page rendered",
    unit: "ms",
    comparison: "max",
    aggregate: "median",
    target: 1000,
    note: "Runtime already loaded.",
    method: "Same markers as cold start, without unloading the runtime; median of 10 launches.",
  },
  {
    id: "setDataToPaint",
    label: "setData to painted update (payload up to 20 KB)",
    unit: "ms",
    comparison: "max",
    aggregate: "median",
    target: 100,
    note: "Median.",
    method: "Service sends a 20 KB `setData`; the View Runtime acknowledges after the next animation frame that painted it; median of 50 updates.",
  },
  {
    id: "scroll500",
    label: "Scroll a list of 500 simple items",
    unit: "fps",
    comparison: "min",
    aggregate: "median",
    target: 50,
    note: "Median; no frame stall over 200 ms.",
    method: "Programmatic scroll over the list for 10 s while recording frame timestamps; median frame rate and the longest gap are reported.",
  },
  {
    id: "memoryPeak",
    label: "Memory of the sample app above the host idle baseline",
    unit: "MB",
    comparison: "max",
    aggregate: "peak",
    target: 200,
    note: "Peak.",
    method: "Host idle resident set sampled before launch; peak resident set of the host process during a scripted 5-minute session; difference reported.",
  },
  {
    id: "install2MB",
    label: "Install of a 2 MB package including verification",
    unit: "ms",
    comparison: "max",
    aggregate: "median",
    target: 3000,
    note: "Including signature and per-file hash verification.",
    method: "Host timestamp before reading the archive minus the timestamp after the package is verified and atomically committed; median of 5 installs.",
  },
] as const;

export interface DeviceInfo {
  /** Appendix A reference device; `UNVERIFIED` until the owner names it. */
  device: string;
  os: string;
  webview: string;
  runtime: string;
  packageVersion: string;
}

export interface MetricSample {
  metric: MetricId;
  /** Every raw sample, so a median cannot hide a bad tail. */
  samples: number[];
  median: number;
  /** Longest frame gap for `scroll500`, in ms. */
  worstFrameGapMs?: number;
  device: DeviceInfo;
  measuredAt: string;
}

export interface MetricResult {
  metric: MetricId;
  target: number;
  measured: number;
  unit: MetricDefinition["unit"];
  pass: boolean;
  /** A missed target needs at least two documented optimization attempts. */
  optimizationAttempts: string[];
  knownLimitation?: string;
}

export function median(samples: readonly number[]): number {
  if (samples.length === 0) throw new RangeError("median needs at least one sample");
  const sorted = [...samples].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Judge one metric. A miss without two optimization attempts is not a valid
 * result: it is an unfinished measurement, not a known limitation.
 */
export function judgeMetric(sample: MetricSample, attempts: string[] = [], knownLimitation?: string): MetricResult {
  const definition = METRICS.find((metric) => metric.id === sample.metric);
  if (!definition) throw new RangeError(`unknown metric ${sample.metric}`);
  const measured = definition.aggregate === "median" ? median(sample.samples) : Math.max(...sample.samples);
  const pass = definition.comparison === "max" ? measured <= definition.target : measured >= definition.target;
  if (!pass && attempts.length < 2) {
    throw new RangeError(`metric ${sample.metric} missed its target and needs two documented optimization attempts`);
  }
  return {
    metric: sample.metric,
    target: definition.target,
    measured,
    unit: definition.unit,
    pass,
    optimizationAttempts: attempts,
    ...(knownLimitation ? { knownLimitation } : {}),
  };
}

/** Human-readable one-line summary used in reports. */
export function formatMetricResult(result: MetricResult): string {
  const value = result.unit === "ms" ? `${result.measured.toFixed(0)} ms` : `${result.measured.toFixed(1)} ${result.unit}`;
  const target = result.unit === "ms" ? `${result.target} ms` : `${result.target} ${result.unit}`;
  return `${result.metric}: ${value} (target ${target}) ${result.pass ? "PASS" : "MISS"}`;
}
