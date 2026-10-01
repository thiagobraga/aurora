import { describe, expect, it } from "vitest";
import { primaryTools } from "../components/ProjectCard";
import { ansiSegments, bytes, coverGradient } from "../lib/format";
import { brandIcon } from "../lib/icons";
import type { Tool } from "../types";

describe("format", () => {
  it("formats bytes", () => {
    expect(bytes(0)).toBe("0 B");
    expect(bytes(1536)).toBe("1.5 KB");
    expect(bytes(3 * 1024 ** 3)).toBe("3.0 GB");
    expect(bytes(undefined)).toBe("–");
  });

  it("maps ANSI colors and strips other escapes", () => {
    const segs = ansiSegments("\x1b[32m✓ ok\x1b[0m plain\x1b[2K");
    expect(segs).toEqual([
      { text: "✓ ok", cls: "text-nord14" },
      { text: " plain", cls: undefined },
    ]);
  });

  it("builds a deterministic cover gradient", () => {
    expect(coverGradient("planner")).toBe(coverGradient("planner"));
    expect(coverGradient("planner")).not.toBe(coverGradient("petsy"));
  });
});

describe("tools", () => {
  const t = (id: string, category: Tool["category"], rank: number): Tool => ({ id, name: id, category, rank, source: "x" });

  it("keeps only badge-worthy tools on cards", () => {
    const tools = [t("react", "framework", 10), t("vitest", "testing", 50), t("docker", "infra", 14), t("zustand", "library", 47), t("nodedotjs", "runtime", 15)];
    expect(primaryTools(tools).map((x) => x.id)).toEqual(["react", "docker", "nodedotjs"]);
  });

  it("resolves brand icons with aliases", () => {
    expect(brandIcon("react")?.title).toBe("React");
    expect(brandIcon("redis-client")?.title).toBe("Redis");
    expect(brandIcon("does-not-exist")).toBeUndefined();
  });
});
