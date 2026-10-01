import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AppState, Commit, Job, Manifest, Project, ProjectStatus, SystemResponse, Template } from "../types";
import { api } from "./client";

export const keys = {
  projects: ["projects"] as const,
  project: (slug: string) => ["project", slug] as const,
  commits: (slug: string) => ["commits", slug] as const,
  jobs: (slug?: string) => ["jobs", slug ?? "all"] as const,
  state: ["state"] as const,
  templates: ["templates"] as const,
  system: ["system"] as const,
};

export const useProjects = () =>
  useQuery({
    queryKey: keys.projects,
    queryFn: () => api<{ projects: Project[]; status: Record<string, ProjectStatus> }>("/projects"),
  });

export const useProject = (slug: string) =>
  useQuery({
    queryKey: keys.project(slug),
    queryFn: () => api<{ project: Project; status?: ProjectStatus }>(`/projects/${slug}?fresh=1`),
  });

export const useCommits = (slug: string) =>
  useQuery({
    queryKey: keys.commits(slug),
    queryFn: () => api<{ source: "github" | "local"; repo?: string; commits: Commit[] }>(`/projects/${slug}/commits`),
    staleTime: 5 * 60_000,
  });

export const useJobs = (slug?: string) =>
  useQuery({
    queryKey: keys.jobs(slug),
    queryFn: () => api<{ jobs: Job[] }>(`/jobs${slug ? `?slug=${encodeURIComponent(slug)}` : ""}`),
  });

export const useTemplates = () => useQuery({ queryKey: keys.templates, queryFn: () => api<{ templates: Template[] }>("/templates") });

export const useSystem = () =>
  useQuery({ queryKey: keys.system, queryFn: () => api<SystemResponse>("/system"), refetchInterval: 30_000 });

export const useAppState = () => useQuery({ queryKey: keys.state, queryFn: () => api<{ state: AppState }>("/state") });

export function usePatchState() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<AppState>) => api<{ state: AppState }>("/state", { method: "PATCH", json: patch }),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: keys.state });
      const prev = qc.getQueryData<{ state: AppState }>(keys.state);
      if (prev) qc.setQueryData(keys.state, { state: { ...prev.state, ...patch } });
      return { prev };
    },
    onError: (_e, _p, ctx) => ctx?.prev && qc.setQueryData(keys.state, ctx.prev),
    onSuccess: (data) => qc.setQueryData(keys.state, data),
  });
}

export function usePatchProject(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Manifest>) => api<{ project: Project }>(`/projects/${slug}`, { method: "PATCH", json: patch }),
    onSuccess: (data) => {
      qc.setQueryData(keys.project(slug), (old: { project: Project; status?: ProjectStatus } | undefined) => ({ ...old, project: data.project }));
      qc.invalidateQueries({ queryKey: keys.projects });
    },
  });
}

export function useToggleFavorite() {
  const { data } = useAppState();
  const patch = usePatchState();
  return (slug: string) => {
    const favs = data?.state.favorites ?? [];
    patch.mutate({ favorites: favs.includes(slug) ? favs.filter((f) => f !== slug) : [...favs, slug] });
  };
}
