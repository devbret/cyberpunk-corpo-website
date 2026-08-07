import type { DeptSketches } from "./types";
import { RD_SKETCHES } from "./rd";
import { SEC_SKETCHES } from "./sec";
import { FIN_SKETCHES } from "./fin";
import { AI_SKETCHES } from "./ai";
import { OPS_SKETCHES } from "./ops";
import { PR_SKETCHES } from "./pr";
import { LGL_SKETCHES } from "./lgl";
import { CSG_SKETCHES } from "./csg";

export const DEPT_SKETCHES: Record<string, DeptSketches> = {
  "R&D": RD_SKETCHES,
  SEC: SEC_SKETCHES,
  FIN: FIN_SKETCHES,
  AI: AI_SKETCHES,
  OPS: OPS_SKETCHES,
  PR: PR_SKETCHES,
  LGL: LGL_SKETCHES,
  CSG: CSG_SKETCHES,
};

export function sketchesFor(code: string): DeptSketches {
  return DEPT_SKETCHES[code] ?? RD_SKETCHES;
}

export type { DeptSketches, SketchSpec, SketchEnv } from "./types";
