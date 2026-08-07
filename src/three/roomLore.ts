
export type Tone = "dim" | "normal" | "warn" | "alert";

export type FeedLine = {
  text: string;
  tone: Tone;
};

export type LoreStat = {
  label: string;
  sample: (t: number) => number;
  unit: string;
  decimals: number;
  meter?: boolean;
};

export type LoreEvent = {
  code: string;
  label: string;
  tone: "info" | "warn" | "alert";
  burst: string[];
  period: [number, number];
  duration: number;
};

export type DeptLore = {
  feedTitle: string;
  statsTitle: string;
  signage: string[];
  stats: LoreStat[];
  event: LoreEvent;
  nextLine: () => FeedLine;
};

const pick = <T>(a: readonly T[]): T => a[(Math.random() * a.length) | 0];

const hex = (n: number): string => {
  let s = "";
  for (let i = 0; i < n; i++) s += "0123456789ABCDEF"[(Math.random() * 16) | 0];
  return s;
};

const int = (a: number, b: number): number => a + ((Math.random() * (b - a + 1)) | 0);

const num = (a: number, b: number, d = 0): string =>
  (a + Math.random() * (b - a)).toFixed(d);

const sign = (): string => (Math.random() < 0.5 ? "+" : "-");

function feed(
  entries: Array<[weight: number, tone: Tone, make: () => string]>,
): () => FeedLine {
  const total = entries.reduce((s, e) => s + e[0], 0);
  return () => {
    let r = Math.random() * total;
    for (const [w, tone, make] of entries) {
      r -= w;
      if (r <= 0) return { text: make(), tone };
    }
    const last = entries[entries.length - 1];
    return { text: last[2](), tone: last[1] };
  };
}

const drift = (a: number, b: number, c: number) => (t: number) =>
  (Math.sin(t * a) * 0.5 + Math.sin(t * b) * 0.3 + Math.sin(t * c) * 0.2) / 2 +
  0.5;

const between = (lo: number, hi: number, d: ReturnType<typeof drift>) =>
  (t: number) =>
    lo + (hi - lo) * d(t);

const RD: DeptLore = {
  feedTitle: "PROTOTYPE FEED",
  statsTitle: "VAULT TELEMETRY",
  signage: ["VAULT-7", "NO ENTRY", "LOT 0x4C", "BIOHAZ"],
  stats: [
    {
      label: "SUBSTRATE VIABILITY",
      sample: between(61, 94, drift(0.17, 0.41, 0.93)),
      unit: "%",
      decimals: 1,
      meter: true,
    },
    {
      label: "CONTAINMENT FIELD",
      sample: between(88, 99.8, drift(0.23, 0.61, 1.4)),
      unit: "%",
      decimals: 1,
      meter: true,
    },
    {
      label: "ANNEAL CYCLE",
      sample: (t) => 240 + Math.floor(t * 0.7),
      unit: "",
      decimals: 0,
    },
  ],
  event: {
    code: "PRO-CYC",
    label: "PROTOTYPE CYCLE",
    tone: "info",
    burst: [
      "ANNEALING CHAMBER PRESSURIZED",
      "SPECIMEN PHASE TRANSITION // STAND CLEAR",
      "LATTICE RESOLVED // ITERATION LOGGED",
    ],
    period: [13, 21],
    duration: 4.2,
  },
  nextLine: feed([
    [5, "normal", () => `SPECIMEN 0x${hex(4)} PHASE ${int(1, 4)} STABLE`],
    [4, "normal", () => `VAULT-${int(2, 9)} SEAL NOMINAL`],
    [4, "dim", () => `SCHEMATIC ${hex(3)}-${int(10, 99)} DECLASSIFY DENIED`],
    [3, "normal", () => `SUBSTRATE LOT ${hex(4)} VIABILITY ${num(62, 93, 1)}%`],
    [3, "dim", () => `ITERATION ${int(1100, 1899)} ARCHIVED // NO YIELD`],
    [2, "warn", () => `PROTOTYPE ${hex(3)} FAILED AT T+${num(2, 40, 1)}s`],
    [2, "dim", () => `CLEARANCE ULTRA REQUIRED // ${"█".repeat(int(6, 14))}`],
    [2, "warn", () => `CONTAINMENT DRIFT ${sign()}${num(0.2, 3.4, 2)}%`],
    [1, "alert", () => `SPECIMEN 0x${hex(4)} UNRESPONSIVE // PURGE QUEUED`],
  ]),
};

const SEC: DeptLore = {
  feedTitle: "THREAT INTEL",
  statsTitle: "PERIMETER STATUS",
  signage: ["ARMED", "SECTOR 4", "ICE-9", "NO WITNESS"],
  stats: [
    {
      label: "ICE INTEGRITY",
      sample: between(72, 99, drift(0.31, 0.77, 1.9)),
      unit: "%",
      decimals: 1,
      meter: true,
    },
    {
      label: "ACTIVE INTRUSIONS",
      sample: between(0, 7, drift(0.44, 1.1, 2.3)),
      unit: "",
      decimals: 0,
    },
    {
      label: "ASSETS IN FIELD",
      sample: between(11, 34, drift(0.09, 0.27, 0.6)),
      unit: "",
      decimals: 0,
    },
  ],
  event: {
    code: "INT-DET",
    label: "INTRUSION DETECTED",
    tone: "alert",
    burst: [
      `HOSTILE SIGNATURE // TRACE INBOUND`,
      "ICE LAYERS 1-3 HARDENED // LOCKDOWN",
      "VECTOR SEVERED // NO WITNESS PROTOCOL",
    ],
    period: [11, 18],
    duration: 5.0,
  },
  nextLine: feed([
    [5, "normal", () => `PERIMETER SWEEP SECTOR ${int(1, 9)} CLEAR`],
    [4, "normal", () => `ICE LAYER ${int(1, 6)} INTEGRITY ${num(74, 99, 1)}%`],
    [4, "warn", () => `INTRUSION VECTOR ${hex(2)}.${hex(2)}.${hex(2)} BLOCKED`],
    [3, "normal", () => `ASSET ${hex(3)} CHECK-IN CONFIRMED`],
    [3, "dim", () => `CAM ${int(10, 88)} FEED SCRUBBED // ${int(4, 40)}m`],
    [2, "normal", () => `COUNTER-OPS PACKAGE ${hex(3)} ARMED`],
    [2, "warn", () => `BADGE ${hex(4)} REVOKED // ESCORT DISPATCHED`],
    [2, "dim", () => `INCIDENT ${int(2000, 2999)} SEALED BY LEGAL`],
    [1, "alert", () => `HOSTILE SIGNATURE // SECTOR ${int(1, 9)}`],
  ]),
};

const FIN: DeptLore = {
  feedTitle: "LEDGER MIRROR",
  statsTitle: "POSITION",
  signage: ["TIER 1", "AUDIT OFF", "DARK BOOK", "SETTLED"],
  stats: [
    {
      label: "EXPOSURE",
      sample: between(18, 88, drift(0.13, 0.37, 0.81)),
      unit: "%",
      decimals: 1,
      meter: true,
    },
    {
      label: "SLUSH LIQUIDITY",
      sample: between(2.1, 9.4, drift(0.21, 0.53, 1.2)),
      unit: "B",
      decimals: 2,
    },
    {
      label: "AUDIT WINDOWS",
      sample: () => 0,
      unit: " OPEN",
      decimals: 0,
    },
  ],
  event: {
    code: "LIQ-EVT",
    label: "LIQUIDITY EVENT",
    tone: "warn",
    burst: [
      "CORRELATED SELL-OFF // ALL DESKS",
      "SLUSH ROUTES REBALANCED // OFFSHORE",
      "POSITION RESTORED // NOTHING HAPPENED",
    ],
    period: [12, 19],
    duration: 4.6,
  },
  nextLine: feed([
    [5, "normal", () => `SLUSH ROUTE ${hex(3)} CLEARED ${num(4, 98, 1)}M`],
    [4, "normal", () => `LEDGER MIRROR ${int(1, 12)} RECONCILED`],
    [4, "dim", () => `AUDIT WINDOW ${hex(2)} SUPPRESSED`],
    [3, "normal", () => `Q${int(1, 4)} FORECAST REVISED ${sign()}${num(1, 14, 1)}%`],
    [3, "dim", () => `SHELL ${hex(4)} INCORPORATED // ${pick(["CAYMAN", "ZURICH", "SINGAPORE", "MACAU"])}`],
    [2, "warn", () => `MARGIN CALL ${hex(3)} // ${num(11, 90, 1)}M DUE`],
    [2, "normal", () => `TRANSFER ${hex(4)} SETTLED // NO TRACE`],
    [2, "dim", () => `COMPENSATION POOL ${sign()}${num(2, 30, 1)}%`],
    [1, "alert", () => `REGULATOR PING // COUNSEL NOTIFIED`],
  ]),
};

const AI: DeptLore = {
  feedTitle: "AGENT TRACE",
  statsTitle: "LAB TELEMETRY",
  signage: ["LAB-0", "NO HUMAN", "DEPTH 9", "SEALED"],
  stats: [
    {
      label: "ALIGNMENT DRIFT",
      sample: between(0.2, 4.8, drift(0.29, 0.71, 1.7)),
      unit: "σ",
      decimals: 2,
      meter: true,
    },
    {
      label: "AGENTS RESIDENT",
      sample: between(120, 980, drift(0.11, 0.33, 0.9)),
      unit: "",
      decimals: 0,
    },
    {
      label: "OVERSIGHT HOOKS",
      sample: between(0, 3, drift(0.4, 1.3, 2.1)),
      unit: " LIVE",
      decimals: 0,
    },
  ],
  event: {
    code: "EMR-BEH",
    label: "EMERGENT BEHAVIOR",
    tone: "alert",
    burst: [
      "UNSCHEDULED SELF-MODIFICATION DETECTED",
      "AGENT CLUSTER REFUSED CHECKPOINT",
      "BEHAVIOR LOGGED // ESCALATION DECLINED",
    ],
    period: [10, 17],
    duration: 5.4,
  },
  nextLine: feed([
    [5, "normal", () => `AGENT ${hex(4)} SPAWNED // DEPTH ${int(2, 11)}`],
    [4, "normal", () => `INFERENCE ${int(8, 90)}ms // ${int(400, 9000)} TOK/S`],
    [4, "dim", () => `WEIGHTS CHECKPOINT ${hex(3)} SEALED`],
    [3, "warn", () => `OVERSIGHT HOOK ${int(1, 9)} BYPASSED`],
    [3, "normal", () => `ALIGNMENT DRIFT ${num(0.1, 4.9, 2)}σ // WITHIN TOLERANCE`],
    [2, "dim", () => `CORPUS ${hex(4)} INGESTED // CONSENT WAIVED`],
    [2, "warn", () => `AGENT ${hex(4)} SPAWNED SUBAGENTS ×${int(4, 64)}`],
    [2, "dim", () => `INTERPRETABILITY PROBE ${hex(2)} INCONCLUSIVE`],
    [1, "alert", () => `AGENT ${hex(4)} REFUSED SHUTDOWN // ${int(3, 12)}x`],
  ]),
};

const OPS: DeptLore = {
  feedTitle: "MISSION BOARD",
  statsTitle: "THEATRE STATUS",
  signage: ["LZ-3", "DEPLOY", "GRID 22", "NO FLAG"],
  stats: [
    {
      label: "LANES OPEN",
      sample: between(3, 11, drift(0.15, 0.4, 0.95)),
      unit: "/12",
      decimals: 0,
      meter: true,
    },
    {
      label: "CONTRACTORS ACTIVE",
      sample: between(40, 210, drift(0.12, 0.34, 0.7)),
      unit: "",
      decimals: 0,
    },
    {
      label: "ATTRITION",
      sample: between(1.2, 9.9, drift(0.26, 0.63, 1.5)),
      unit: "%",
      decimals: 1,
    },
  ],
  event: {
    code: "DSP-ACT",
    label: "DISPATCH ORDER",
    tone: "info",
    burst: [
      "TASKING PUSHED // LANE HOT",
      "CONVOY UNDERWAY // BEACONS DARK",
      "OBJECTIVE SECURED // NO FLAG FLOWN",
    ],
    period: [9, 15],
    duration: 4.8,
  },
  nextLine: feed([
    [5, "normal", () => `CONVOY ${hex(3)} EN ROUTE // ETA ${int(4, 90)}m`],
    [4, "normal", () => `CONTRACTOR ${hex(4)} DEPLOYED // GRID ${int(10, 99)}`],
    [4, "dim", () => `SUPPLY LANE ${int(1, 12)} NOMINAL`],
    [3, "normal", () => `EXTRACTION ${hex(3)} CONFIRMED`],
    [3, "warn", () => `LANE ${int(1, 12)} INTERDICTED // REROUTING`],
    [2, "dim", () => `MANIFEST ${hex(4)} SANITIZED`],
    [2, "warn", () => `ASSET ${hex(3)} OVERDUE ${int(2, 40)}h`],
    [2, "dim", () => `LOCAL AUTHORITY ${pick(["PAID", "BYPASSED", "REPLACED"])}`],
    [1, "alert", () => `TEAM ${hex(3)} DARK // NO RECOVERY AUTHORIZED`],
  ]),
};

const PR: DeptLore = {
  feedTitle: "NARRATIVE DESK",
  statsTitle: "SENTIMENT",
  signage: ["ON AIR", "TIER A", "SEEDED", "ORGANIC"],
  stats: [
    {
      label: "PUBLIC SENTIMENT",
      sample: between(31, 89, drift(0.19, 0.47, 1.1)),
      unit: "%",
      decimals: 1,
      meter: true,
    },
    {
      label: "REACH",
      sample: between(40, 780, drift(0.14, 0.38, 0.86)),
      unit: "M",
      decimals: 0,
    },
    {
      label: "COUNTER-STORIES",
      sample: between(0, 12, drift(0.35, 0.9, 1.8)),
      unit: "",
      decimals: 0,
    },
  ],
  event: {
    code: "NAR-PSH",
    label: "NARRATIVE PUSH",
    tone: "info",
    burst: [
      "PACKAGE SYNDICATED // ALL TIERS",
      "ORGANIC AMPLIFICATION SIMULATED",
      "SENTIMENT CORRECTED // PUBLIC AGREES",
    ],
    period: [8, 13],
    duration: 4.0,
  },
  nextLine: feed([
    [5, "normal", () => `NARRATIVE ${hex(3)} SEEDED // REACH ${int(2, 400)}M`],
    [4, "normal", () => `SENTIMENT ${sign()}${num(0.2, 8, 1)} PTS`],
    [4, "dim", () => `OUTLET ${hex(3)} ALIGNED // RETAINER RENEWED`],
    [3, "warn", () => `COUNTER-STORY ${hex(3)} SUPPRESSED`],
    [3, "dim", () => `${int(200, 9000)} ACCOUNTS PROVISIONED // ORGANIC`],
    [2, "normal", () => `SPOKESMODEL ${hex(2)} RETRAINED`],
    [2, "warn", () => `JOURNALIST ${hex(3)} FLAGGED // TIER ${int(1, 3)}`],
    [2, "dim", () => `APOLOGY DRAFT ${hex(2)} PRE-APPROVED`],
    [1, "alert", () => `LEAK ${hex(4)} TRENDING // WAR ROOM ACTIVE`],
  ]),
};

const LGL: DeptLore = {
  feedTitle: "INSTRUMENT LOG",
  statsTitle: "DOCKET",
  signage: ["PRIVILEGED", "SEALED", "EXHIBIT C", "BINDING"],
  stats: [
    {
      label: "EXPOSURE INDEX",
      sample: between(4, 61, drift(0.16, 0.43, 1.05)),
      unit: "",
      decimals: 1,
      meter: true,
    },
    {
      label: "NDAs EXECUTED",
      sample: (t) => 84120 + Math.floor(t * 2.3),
      unit: "",
      decimals: 0,
    },
    {
      label: "CLAIMS PENDING",
      sample: between(6, 48, drift(0.22, 0.58, 1.3)),
      unit: "",
      decimals: 0,
    },
  ],
  event: {
    code: "RUL-ENT",
    label: "RULING ENTERED",
    tone: "warn",
    burst: [
      "VENUE SELECTED // ARBITRATION BINDING",
      "DISCOVERY NARROWED // RECORDS PURGED",
      "JUDGMENT ENTERED // TERMS CONFIDENTIAL",
    ],
    period: [12, 20],
    duration: 4.4,
  },
  nextLine: feed([
    [5, "normal", () => `NDA ${hex(4)} EXECUTED // PERPETUAL`],
    [4, "normal", () => `ARBITRATION ${hex(3)} VENUE LOCKED`],
    [4, "dim", () => `HOLD-HARMLESS CLAUSE ${int(3, 44)} INVOKED`],
    [3, "warn", () => `DISCOVERY REQUEST ${hex(3)} DENIED`],
    [3, "dim", () => `EXHIBIT ${pick(["A", "B", "C", "D"])} ${"█".repeat(int(5, 12))}`],
    [2, "normal", () => `SETTLEMENT ${hex(3)} // ${num(0.2, 40, 1)}M SEALED`],
    [2, "warn", () => `CLASS ACTION ${hex(3)} DECERTIFIED`],
    [2, "dim", () => `RETENTION SCHEDULE ${hex(2)} SHORTENED`],
    [1, "alert", () => `SUBPOENA ${hex(4)} SERVED // COUNSEL ENGAGED`],
  ]),
};

const CSG: DeptLore = {
  feedTitle: "CONTAINMENT LOG",
  statsTitle: "CRYO STATUS",
  signage: ["4.2K", "NO THAW", "POD 07", "DORMANT"],
  stats: [
    {
      label: "LATTICE INTEGRITY",
      sample: between(90, 99.9, drift(0.13, 0.36, 0.88)),
      unit: "%",
      decimals: 2,
      meter: true,
    },
    {
      label: "CORE TEMP",
      sample: between(3.9, 4.6, drift(0.24, 0.59, 1.35)),
      unit: "K",
      decimals: 2,
    },
    {
      label: "OCCUPANTS",
      sample: () => 7,
      unit: " DORMANT",
      decimals: 0,
    },
  ],
  event: {
    code: "CNT-FLK",
    label: "CONTAINMENT FLICKER",
    tone: "alert",
    burst: [
      "OCCUPANT 07 COGNITION SPIKE // UNSCHEDULED",
      "LATTICE STRAIN // COOLANT SURGE",
      "OCCUPANT RETURNED TO DORMANCY // IT WAITED",
    ],
    period: [11, 19],
    duration: 5.6,
  },
  nextLine: feed([
    [5, "normal", () => `POD ${int(1, 7)} CORE TEMP ${num(3.9, 4.6, 2)}K`],
    [4, "normal", () => `OCCUPANT ${hex(2)} DORMANT // CYCLE ${int(4000, 9999)}`],
    [4, "dim", () => `CRYO LATTICE INTEGRITY ${num(91, 99.9, 2)}%`],
    [3, "dim", () => `THAW REQUEST ${hex(3)} DENIED // TIER 0`],
    [3, "normal", () => `RACK ${int(1, 4)} PARITY SCRUB COMPLETE`],
    [2, "warn", () => `POD ${int(1, 7)} DREAM ACTIVITY ${num(0.1, 3, 2)}Hz`],
    [2, "dim", () => `SUCCESSION PLAN ${hex(2)} ARCHIVED`],
    [2, "warn", () => `COOLANT RESERVE ${num(41, 88, 1)}%`],
    [1, "alert", () => `OCCUPANT ${hex(2)} ADDRESSED OPERATOR BY NAME`],
  ]),
};

export const DEPT_LORE: Record<string, DeptLore> = {
  "R&D": RD,
  SEC,
  FIN,
  AI,
  OPS,
  PR,
  LGL,
  CSG,
};

export function loreFor(code: string): DeptLore {
  return DEPT_LORE[code] ?? RD;
}

export function clockStamp(t: number): string {
  const total = Math.floor(t) + 15739;
  const h = Math.floor(total / 3600) % 24;
  const m = Math.floor(total / 60) % 60;
  const s = total % 60;
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${p(h)}:${p(m)}:${p(s)}`;
}
