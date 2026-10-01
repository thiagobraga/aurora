import { useEffect, useState } from "react";

type Api = "checking" | "online" | "none";

export default function App() {
  const [api, setApi] = useState<Api>("checking");

  useEffect(() => {
    fetch("/api/v1/health")
      .then((r) => r.json())
      .then((b) => setApi(b?.ok ? "online" : "none"))
      .catch(() => setApi("none"));
  }, []);

  return (
    <main className="min-h-dvh grid place-items-center p-6">
      <div className="max-w-lg w-full rounded-2xl bg-nord1/60 p-8 shadow-xl">
        <h1 className="text-2xl font-bold text-nord8">__NAME__</h1>
        <p className="mt-2 text-sm opacity-80">__DESCRIPTION__</p>
        <p className="mt-6 text-xs">
          API:{" "}
          <span className={api === "online" ? "text-nord14" : "text-nord11"} data-testid="api">
            {api}
          </span>
        </p>
      </div>
    </main>
  );
}
