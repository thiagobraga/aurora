export function bytes(n?: number, digits = 1): string {
  if (n === undefined || !Number.isFinite(n)) return "–";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : digits)} ${u[i]}`;
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
export function ago(iso?: string | number): string {
  if (!iso) return "–";
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(s);
  if (abs < 60) return rtf.format(Math.round(s), "second");
  if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(s / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(s / 86400), "day");
  if (abs < 86400 * 365) return rtf.format(Math.round(s / (86400 * 30)), "month");
  return rtf.format(Math.round(s / (86400 * 365)), "year");
}

export function duration(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const AURORA = ["#5e81ac", "#88c0d0", "#8fbcbb", "#a3be8c", "#b48ead", "#81a1c1", "#d08770"];

/** Deterministic aurora-like gradient for projects without a cover image. */
export function coverGradient(seed: string): string {
  const h = hash(seed);
  const a = AURORA[h % AURORA.length];
  const b = AURORA[(h >>> 3) % AURORA.length];
  const c = AURORA[(h >>> 6) % AURORA.length];
  const x1 = 10 + (h % 50);
  const x2 = 50 + ((h >>> 9) % 45);
  return [
    `radial-gradient(70% 90% at ${x1}% 0%, ${a}cc, transparent 70%)`,
    `radial-gradient(60% 80% at ${x2}% 20%, ${b}99, transparent 70%)`,
    `radial-gradient(80% 60% at 50% 110%, ${c}66, transparent 70%)`,
    "linear-gradient(160deg, #3b4252, #2e3440)",
  ].join(", ");
}

/** Converts basic ANSI SGR colors to spans; everything else is stripped. */
const ANSI: Record<string, string> = {
  "30": "text-nord3", "31": "text-nord11", "32": "text-nord14", "33": "text-nord13", "34": "text-nord9",
  "35": "text-nord15", "36": "text-nord8", "37": "text-nord5", "90": "text-nord3", "91": "text-nord11",
  "92": "text-nord14", "93": "text-nord13", "94": "text-nord9", "95": "text-nord15", "96": "text-nord7", "97": "text-nord6",
};
export function ansiSegments(input: string): { text: string; cls?: string }[] {
  const out: { text: string; cls?: string }[] = [];
  let cls: string | undefined;
  // eslint-disable-next-line no-control-regex
  const re = /\x1b\[([0-9;]*)m/g;
  let last = 0;
  // eslint-disable-next-line no-control-regex
  const clean = input.replace(/\x1b\[[0-9;?]*[A-HJKSTfhlsu]/g, "").replace(/\r(?!\n)/g, "\n");
  for (let m = re.exec(clean); m; m = re.exec(clean)) {
    if (m.index > last) out.push({ text: clean.slice(last, m.index), cls });
    const codes = m[1].split(";");
    for (const c of codes) {
      if (c === "0" || c === "" || c === "39") cls = undefined;
      else if (ANSI[c]) cls = ANSI[c];
    }
    last = re.lastIndex;
  }
  if (last < clean.length) out.push({ text: clean.slice(last), cls });
  return out;
}
