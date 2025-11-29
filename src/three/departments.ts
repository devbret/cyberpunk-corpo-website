export type Department = {
  id: string;
  title: string;
  path: string;
  color: number;
  blurb: string;
};

export const DEPARTMENTS: Department[] = [
  {
    id: "rd",
    title: "R&D: Black Vault",
    path: "/r-and-d",
    color: 0x7c3aed,
    blurb: "Prototype archives, classified schematics.",
  },
  {
    id: "sec",
    title: "Security Operations",
    path: "/security",
    color: 0xff4d4d,
    blurb: "Threat intel, incident logs, counter-ops.",
  },
  {
    id: "finance",
    title: "Finance Directorate",
    path: "/finance",
    color: 0xffa500,
    blurb: "Ledger mirrors, slush accounts, forecasts.",
  },
  {
    id: "ai",
    title: "AI Systems Lab",
    path: "/ai-systems",
    color: 0x00ffff,
    blurb: "Autonomous agents, oversight bypasses.",
  },
  {
    id: "ops",
    title: "Field Operations",
    path: "/operations",
    color: 0xffff00,
    blurb: "Contractors, missions, supply routes.",
  },
  {
    id: "pr",
    title: "PR & Influence",
    path: "/influence",
    color: 0x66ccff,
    blurb: "Media scaffolds, narrative tuning.",
  },
  {
    id: "legal",
    title: "Legal Instruments",
    path: "/legal",
    color: 0x00ff7f,
    blurb: "Hold-harmless, NDAs, arbitration kits.",
  },
  {
    id: "archives",
    title: "Cold Archives",
    path: "/archives",
    color: 0xff00ff,
    blurb: "Legacy ops, deprecated doctrines.",
  },
];

export function deptForIndex(i: number): Department {
  return DEPARTMENTS[i % DEPARTMENTS.length];
}
