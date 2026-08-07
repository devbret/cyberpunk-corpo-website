import type { RoomProgram } from "./context";
import { buildRDRoom } from "./rd";
import { buildSecRoom } from "./sec";
import { buildFinRoom } from "./fin";
import { buildAIRoom } from "./ai";
import { buildOpsRoom } from "./ops";
import { buildPRRoom } from "./pr";
import { buildLegalRoom } from "./lgl";
import { buildColdRoom } from "./csg";

export const ROOM_PROGRAMS: Record<string, RoomProgram> = {
  "R&D": buildRDRoom,
  SEC: buildSecRoom,
  FIN: buildFinRoom,
  AI: buildAIRoom,
  OPS: buildOpsRoom,
  PR: buildPRRoom,
  LGL: buildLegalRoom,
  CSG: buildColdRoom,
};

export function programFor(code: string): RoomProgram {
  return ROOM_PROGRAMS[code] ?? buildRDRoom;
}

export type { RoomCtx, RoomProgram } from "./context";
