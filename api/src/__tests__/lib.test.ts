import { describe, expect, it } from "vitest";
import { config } from "../config.js";
import { projectPath, safeJoin, slugify } from "../lib/fs.js";
import { parseBytes, parseLabels, parsePs } from "../services/docker.js";
import { githubSlug } from "../services/git.js";
import { commonRoot } from "../services/importer.js";

describe("paths", () => {
  it("slugifies names", () => {
    expect(slugify("Meu Projeto Ção!")).toBe("meu-projeto-cao");
    expect(slugify("../../etc")).toBe("etc");
    expect(slugify("   ")).toBe("project");
  });

  it("refuses traversal in slugs", () => {
    expect(() => projectPath("../etc")).toThrow();
    expect(() => projectPath(".aurora")).toThrow();
    expect(projectPath("ok-1")).toBe(`${config.projectsDir}/ok-1`);
  });

  it("safeJoin blocks zip-slip", () => {
    expect(safeJoin("/x", "a/b.txt")).toBe("/x/a/b.txt");
    expect(() => safeJoin("/x", "../evil")).toThrow();
    expect(() => safeJoin("/x", "a/../../evil")).toThrow();
    expect(() => safeJoin("/x", "/etc/passwd")).toThrow();
    expect(() => safeJoin("/x", "a\\..\\..\\evil")).toThrow();
  });

  it("finds a shared top folder", () => {
    expect(commonRoot(["site/index.html", "site/css/a.css"])).toBe("site");
    expect(commonRoot(["index.html", "css/a.css"])).toBeUndefined();
    expect(commonRoot(["a/x", "b/y"])).toBeUndefined();
  });
});

describe("docker parsing", () => {
  it("parses labels and ps output", () => {
    expect(parseLabels("a=1,com.docker.compose.service=api")).toEqual({ a: "1", "com.docker.compose.service": "api" });
    const line = JSON.stringify({
      ID: "abc",
      Names: "planner-api",
      Image: "planner-api",
      State: "running",
      Status: "Up 3 hours (healthy)",
      Ports: "4000/tcp",
      Labels: "com.docker.compose.project=planner,com.docker.compose.service=api,com.docker.compose.project.working_dir=/p/planner",
      CreatedAt: "x",
    });
    const [c] = parsePs(`${line}\n`);
    expect(c).toMatchObject({ id: "abc", service: "api", health: "healthy", workingDir: "/p/planner", project: "planner" });
  });

  it("parses byte sizes", () => {
    expect(parseBytes("120MiB")).toBe(120 * 1024 ** 2);
    expect(parseBytes("1.5GiB")).toBe(Math.round(1.5 * 1024 ** 3));
    expect(parseBytes("512kB")).toBe(512_000);
  });
});

describe("git", () => {
  it("parses github remotes", () => {
    expect(githubSlug("git@github.com:thiagobraga/planner.git")).toBe("thiagobraga/planner");
    expect(githubSlug("https://github.com/thiagobraga/planner")).toBe("thiagobraga/planner");
    expect(githubSlug("https://gitlab.com/a/b.git")).toBeUndefined();
  });
});
