import { useState } from "react";
import { KeyRound, Settings } from "lucide-react";
import { getToken, setToken } from "../api/client";
import { useAppState, usePatchState } from "../api/hooks";
import { Button, Field, inputCls, Panel } from "../components/ui";
import { useUI } from "../lib/ui";

const EDITORS = [
  { label: "VS Code", value: "vscode://file{path}" },
  { label: "VSCodium", value: "vscodium://file{path}" },
  { label: "Cursor", value: "cursor://file{path}" },
  { label: "Zed", value: "zed://file{path}" },
];

export function SettingsPage() {
  const { data } = useAppState();
  const patch = usePatchState();
  const ui = useUI();
  const [url, setUrl] = useState<string>();
  const [token, setTok] = useState(getToken());
  const current = url ?? data?.state.openFolderUrl ?? "";

  return (
    <div className="space-y-6 max-w-2xl">
      <header>
        <h1 className="font-display text-2xl text-nord6 tracking-tight">Settings</h1>
        <p className="text-xs text-nord4/60 mt-1">Stored in .aurora/state.json inside your projects folder.</p>
      </header>

      <Panel title="Open folder" icon={<Settings size={13} />}>
        <div className="space-y-3">
          <Field label="URL template" hint="{path} is replaced by the project's absolute path. The path is also copied to the clipboard.">
            <input className={inputCls} value={current} onChange={(e) => setUrl(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-1.5">
            {EDITORS.map((e) => (
              <button key={e.value} type="button" onClick={() => setUrl(e.value)} className="h-7 px-2.5 rounded-md text-[11px] bg-nord0/50 border border-white/[0.07] text-nord4/80 hover:text-nord6">
                {e.label}
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <Button
              variant="primary"
              size="sm"
              disabled={!current.includes("{path}")}
              onClick={() => patch.mutate({ openFolderUrl: current }, { onSuccess: () => ui.toast({ kind: "success", text: "Saved" }) })}
            >
              Save
            </Button>
          </div>
        </div>
      </Panel>

      <Panel title="Access token" icon={<KeyRound size={13} />}>
        <div className="space-y-3">
          <Field label="AURORA_TOKEN" hint="Only needed when the API was started with AURORA_TOKEN. Kept in this browser's localStorage.">
            <input className={inputCls} type="password" value={token} onChange={(e) => setTok(e.target.value)} autoComplete="off" />
          </Field>
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                setToken(token);
                location.reload();
              }}
            >
              Save & reload
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
