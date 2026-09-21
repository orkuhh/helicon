import { Switch } from "radix-ui";
import { useEffect, useState, type ReactNode } from "react";
import { useController } from "../../app/context.js";
import type { BrowserDefaultsView } from "../../client.js";
import { BROWSER_PERMISSIONS } from "../browser/browserUiConstants.js";
import { Button, cn } from "../ui/primitives.js";

function Section(props: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-2xs font-semibold tracking-wide text-subtle uppercase">{props.title}</h2>
      <div className="overflow-hidden rounded-2xl bg-raised shadow-card">{props.children}</div>
    </section>
  );
}

function Row(props: { label: string; description?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-t border-line px-4 py-3 first:border-t-0">
      <div className="min-w-[13rem] flex-1 basis-64">
        <p className="text-sm text-fg">{props.label}</p>
        {props.description ? <p className="mt-0.5 text-xs text-pretty text-muted">{props.description}</p> : null}
      </div>
      {props.children ? <div className="min-w-0 w-full @min-[520px]:w-auto">{props.children}</div> : null}
    </div>
  );
}

function Toggle(props: { checked: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <Switch.Root
      checked={props.checked}
      onCheckedChange={props.onChange}
      aria-label={props.label}
      className={cn(
        "relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-full bg-line-strong outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent data-[state=checked]:bg-accent",
      )}
    >
      <Switch.Thumb className="block size-3.5 translate-x-0.5 rounded-full bg-white shadow-[0_1px_2px_oklch(0_0_0/0.3)] transition-transform duration-150 ease-out data-[state=checked]:translate-x-4" />
    </Switch.Root>
  );
}

export function BrowserSettingsSection() {
  const controller = useController();
  const [defaults, setDefaults] = useState<BrowserDefaultsView | null>(null);
  const [profiles, setProfiles] = useState<{ id: string; name: string }[]>([]);
  const [sources, setSources] = useState<{ id: string; name: string; available: boolean; reason?: string }[]>([]);
  const [importStep, setImportStep] = useState<0 | 1 | 2>(0);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [filePath, setFilePath] = useState("");
  const [importResult, setImportResult] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [d, p, s] = await Promise.all([
        controller.client.getBrowserDefaults(),
        controller.client.listBrowserProfiles(),
        controller.client.listBrowserImportSources(),
      ]);
      setDefaults(d);
      setProfiles(p.map((x) => ({ id: x.id, name: x.name })));
      setSources(s);
    })();
  }, [controller]);

  const patch = async (next: Partial<BrowserDefaultsView>) => {
    const updated = await controller.client.patchBrowserDefaults(next);
    setDefaults(updated);
  };

  const togglePermission = (id: string) => {
    if (!defaults) {
      return;
    }
    const set = new Set(defaults.grantedPermissions);
    if (set.has(id)) {
      set.delete(id);
    } else {
      set.add(id);
    }
    void patch({ grantedPermissions: [...set] });
  };

  return (
    <>
      <Section title="Browser">
        <Row label="Floating preview" description="Show the mini-player when the agent drives the browser.">
          <Toggle
            checked={defaults?.autoShowFloatingPreview ?? true}
            label="Auto-show mini player"
            onChange={(on) => void patch({ autoShowFloatingPreview: on })}
          />
        </Row>
        <Row label="Recording overlays" description="Key presses and mouse clicks in tab recordings.">
          <div className="flex flex-col gap-2">
            <Toggle
              checked={defaults?.recordingShowKeyPresses ?? true}
              label="Show key presses"
              onChange={(on) => void patch({ recordingShowKeyPresses: on })}
            />
            <Toggle
              checked={defaults?.recordingShowMousePresses ?? true}
              label="Show mouse presses"
              onChange={(on) => void patch({ recordingShowMousePresses: on })}
            />
          </div>
        </Row>
        <Row label="Pinned local URLs" description="Always probe these URLs for the local-servers list (one per line).">
          <textarea
            className="min-h-[72px] w-full rounded border border-line bg-canvas px-2 py-1 font-mono text-xs"
            value={(defaults?.configuredLocalUrls ?? []).join("\n")}
            onChange={(e) => {
              const urls = e.target.value
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean)
                .slice(0, 32);
              void patch({ configuredLocalUrls: urls });
            }}
            placeholder="http://localhost:3000"
          />
        </Row>
        <Row label="Profile" description="Persistent Chromium profile for cookies and storage.">
          <select
            className="rounded border border-line bg-canvas px-2 py-1 text-sm"
            value={defaults?.profileId ?? "default"}
            onChange={(e) => void patch({ profileId: e.target.value })}
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </Row>
        <Row label="Permissions" description="Granted to preview guests (clipboard, notifications, geolocation).">
          <ul className="space-y-1 text-sm">
            {BROWSER_PERMISSIONS.map((perm) => (
              <li key={perm.id}>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={defaults?.grantedPermissions.includes(perm.id) ?? false}
                    onChange={() => togglePermission(perm.id)}
                  />
                  {perm.label}
                </label>
              </li>
            ))}
          </ul>
        </Row>
        <Row label="Clear profile data" description="Remove cookies or cache for the selected profile.">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void controller.client.clearBrowserProfileData(defaults?.profileId ?? "default", "cookies")}
            >
              Clear cookies
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void controller.client.clearBrowserProfileData(defaults?.profileId ?? "default", "cache")}
            >
              Clear cache
            </Button>
          </div>
        </Row>
        <Row label="Cookie import" description="Import Netscape cookies into the active profile.">
          {importStep === 0 ? (
            <Button size="sm" onClick={() => setImportStep(1)}>Start import wizard</Button>
          ) : null}
          {importStep === 1 ? (
            <div className="space-y-2 text-sm">
              <p className="text-muted">Choose a browser export source:</p>
              <ul className="space-y-1">
                {sources.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      disabled={!s.available}
                      className="text-left text-accent-text hover:underline disabled:opacity-40"
                      title={s.reason}
                      onClick={() => {
                        setSelectedSource(s.id);
                        setImportStep(2);
                      }}
                    >
                      {s.name}
                    </button>
                  </li>
                ))}
              </ul>
              <Button size="sm" variant="ghost" onClick={() => setImportStep(0)}>Cancel</Button>
            </div>
          ) : null}
          {importStep === 2 ? (
            <div className="space-y-2 text-sm">
              <p className="text-muted">Source: {selectedSource}. Paste the absolute path to your cookies.txt file.</p>
              <input
                className="w-full rounded border border-line bg-canvas px-2 py-1 font-mono text-xs"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder="/path/to/cookies.txt"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    void controller.client.importBrowserCookies(filePath).then((r) => {
                      setImportResult(`Imported ${r.imported}, skipped ${r.skipped}.`);
                      setImportStep(0);
                    });
                  }}
                >
                  Import
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setImportStep(1)}>Back</Button>
              </div>
            </div>
          ) : null}
          {importResult ? <p className="text-xs text-muted">{importResult}</p> : null}
        </Row>
      </Section>
    </>
  );
}
