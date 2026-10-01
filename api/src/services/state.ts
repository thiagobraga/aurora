import path from "node:path";
import { z } from "zod";
import { auroraDir } from "../config.js";
import { readJson, writeJson } from "../lib/fs.js";

const fields = {
  favorites: z.array(z.string()),
  view: z.enum(["cards", "list"]),
  listColumns: z.array(z.string()),
  featureColumns: z.array(z.string()),
  openFolderUrl: z.string().max(300),
  sidebarCollapsed: z.boolean(),
  sort: z.enum(["name", "updated", "status"]),
};

/** Aurora-wide preferences, stored in PROJECTS_DIR/.aurora/state.json. */
export const StateSchema = z.object({
  favorites: fields.favorites.default([]),
  view: fields.view.default("cards"),
  listColumns: fields.listColumns.default(["status", "framework", "node", "docker", "database", "tests", "links"]),
  featureColumns: fields.featureColumns.default(["socialLogin", "pwa", "offline", "admin", "backup", "realtime", "i18n", "tests", "e2e", "ci"]),
  openFolderUrl: fields.openFolderUrl.default("vscode://file{path}"),
  sidebarCollapsed: fields.sidebarCollapsed.default(false),
  sort: fields.sort.default("name"),
});

/** No defaults here: a PATCH only touches the keys it sends. */
export const StatePatchSchema = z.object(fields).partial();
export type State = z.infer<typeof StateSchema>;

const file = () => path.join(auroraDir(), "state.json");
let cache: State | undefined;

export async function getState(): Promise<State> {
  if (!cache) cache = StateSchema.parse((await readJson(file())) ?? {});
  return cache;
}

export async function patchState(patch: Partial<State>): Promise<State> {
  const next = StateSchema.parse({ ...(await getState()), ...patch });
  await writeJson(file(), next);
  cache = next;
  return next;
}

export function resetStateCache() {
  cache = undefined;
}
