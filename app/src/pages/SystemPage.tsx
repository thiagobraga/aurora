import { Activity, Box, Cpu, HardDrive, MemoryStick, Server } from "lucide-react";
import { useProjects, useSystem } from "../api/hooks";
import { MemoryBars, TimeArea } from "../components/Charts";
import { Meter, StatTile } from "../components/Stat";
import { Panel } from "../components/ui";
import { bytes, duration } from "../lib/format";
import { useMetrics } from "../lib/metrics";

const SAMPLE_PROJECT_MEM = [
  { name: "planner", value: 412 * 1024 ** 2 },
  { name: "petsy", value: 268 * 1024 ** 2 },
  { name: "sociopata-site", value: 41 * 1024 ** 2 },
];

export function SystemPage() {
  const { data } = useSystem();
  const { data: projects } = useProjects();
  const { series, sample } = useMetrics();
  const last = series.at(-1);
  const names = new Map(projects?.projects.map((p) => [p.slug, p.manifest.name]));
  const perProject = (data?.perProject ?? []).filter((p) => p.memBytes > 0).sort((a, b) => b.memBytes - a.memBytes);
  const memBars = perProject.length ? perProject.map((p) => ({ name: names.get(p.slug) ?? p.slug, value: p.memBytes })) : SAMPLE_PROJECT_MEM;
  const disk = data?.info.disk;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-nord6 tracking-tight">System</h1>
          <p className="text-xs text-nord4/60 mt-1">
            {data ? `${data.info.hostname} · ${data.info.platform} · up ${duration(data.info.uptime)}` : "Loading…"}
            {sample && <span className="ml-2 px-1.5 py-0.5 rounded bg-nord13/15 text-nord13">sample data</span>}
          </p>
        </div>
        <span className="inline-flex items-center gap-2 text-[11px] text-nord4/60">
          <span className={`size-2 rounded-full ${data?.docker ? "bg-nord14" : "bg-nord11"}`} />
          Docker {data?.docker ? "connected" : "unavailable"}
        </span>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="CPU" icon={<Cpu size={13} />} value={`${last?.cpu.toFixed(1) ?? "–"}%`} sub={data ? `${data.info.cpus} cores · load ${last?.load1 ?? "–"}` : undefined} />
        <StatTile label="Memory" icon={<MemoryStick size={13} />} value={last ? bytes(last.memUsed) : "–"} sub={last ? `of ${bytes(last.memTotal)}` : undefined}>
          {last && <Meter value={last.memUsed} max={last.memTotal} color="#B48EAD" />}
        </StatTile>
        <StatTile label="Disk" icon={<HardDrive size={13} />} value={disk ? bytes(disk.total - disk.free) : "–"} sub={disk ? `${bytes(disk.free)} free` : "projects volume"}>
          {disk && <Meter value={disk.total - disk.free} max={disk.total} color="#A3BE8C" />}
        </StatTile>
        <StatTile label="Containers" icon={<Box size={13} />} value={data ? `${data.containers.running}/${data.containers.total}` : "–"} sub="running / total" />
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="CPU usage" icon={<Activity size={13} />}>
          <TimeArea data={series} value={(d) => d.cpu} color="#88C0D0" label="CPU" format={(v) => `${v.toFixed(0)}%`} domain={[0, 100]} height={220} />
        </Panel>
        <Panel title="Memory used" icon={<MemoryStick size={13} />}>
          <TimeArea
            data={series}
            value={(d) => d.memUsed}
            color="#B48EAD"
            label="Memory"
            format={(v) => bytes(v, 1)}
            domain={[0, last?.memTotal ?? 0]}
            ticks={last ? [0, 0.25, 0.5, 0.75, 1].map((f) => f * last.memTotal) : undefined}
            height={220}
          />
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Memory by project" icon={<Server size={13} />} actions={!perProject.length && <span className="text-[11px] text-nord13">sample data</span>}>
          <MemoryBars data={memBars} />
        </Panel>
        <Panel title="Host" icon={<Server size={13} />}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[12px]">
            {[
              ["Hostname", data?.info.hostname],
              ["Platform", data?.info.platform],
              ["Kernel", data?.info.kernel],
              ["CPU", data?.info.cpuModel],
              ["Cores", data?.info.cpus],
              ["Projects dir", disk?.path],
            ].map(([k, v]) => (
              <div key={String(k)} className="contents">
                <dt className="text-nord4/50">{k}</dt>
                <dd className="text-nord5 truncate" title={String(v ?? "")}>{v ?? "–"}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
    </div>
  );
}
