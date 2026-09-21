import { ArrowDownToLine, ArrowLeft, Minus, Plus, RefreshCw, RotateCw, ScrollText } from "lucide-react";
import { Switch } from "radix-ui";
import { useState, type ReactNode } from "react";
import { useApp, useController, useNow } from "../../app/context.js";
import { useOverlayDragProps } from "../../app/frame.js";
import { modelDisplayName } from "../../model/format.js";
import { CODE_THEMES, ZOOM_MAX, ZOOM_MIN, type CodeTheme, type GroupBy, type ThemePref } from "../../model/store.js";
import type { ApprovalMode, ReasoningEffort } from "../../types.js";
import { LEVELS, MODES } from "../composer/Composer.js";
import { CODE_THEME_LABELS, updateSummary } from "../sidebar/Sidebar.js";
import { Modal } from "../ui/overlays.js";
import { TopBar } from "../chrome.js";
import { BrowserSettingsSection } from "./BrowserSettingsSection.js";
import { Button, IconButton, MOD, cn } from "../ui/primitives.js";

/** A row's control: one choice out of a few. Scrolls sideways when the row is too narrow to wrap. */
function Pick<T extends string | null>(props: {
  value: T;
  options: readonly { value: T; label: string; hint?: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex max-w-full min-w-0 items-center gap-1 overflow-x-auto overscroll-x-contain rounded-lg bg-sunken p-0.5 [scrollbar-width:thin]">
      {props.options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          title={option.hint}
          aria-pressed={props.value === option.value}
          disabled={props.disabled}
          onClick={() => props.onChange(option.value)}
          className={cn(
            "h-7 shrink-0 rounded-md px-2.5 text-xs font-medium whitespace-nowrap transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-40",
            props.value === option.value ? "bg-raised text-fg shadow-btn" : "text-muted hover:text-fg",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Toggle(props: { checked: boolean; onChange: (on: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <Switch.Root
      checked={props.checked}
      onCheckedChange={props.onChange}
      disabled={props.disabled}
      aria-label={props.label}
      className="relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-full bg-line-strong outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-accent"
    >
      <Switch.Thumb className="block size-3.5 translate-x-0.5 rounded-full bg-white shadow-[0_1px_2px_oklch(0_0_0/0.3)] transition-transform duration-150 ease-out data-[state=checked]:translate-x-4" />
    </Switch.Root>
  );
}

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
      {/* A floor on the label, or a wide row of choices squeezes it to one word per line instead of wrapping. */}
      <div className="min-w-[13rem] flex-1 basis-64">
        <p className="text-sm text-fg">{props.label}</p>
        {props.description ? <p className="mt-0.5 text-xs text-pretty text-muted">{props.description}</p> : null}
      </div>
      {props.children ? <div className="min-w-0 w-full @min-[520px]:w-auto">{props.children}</div> : null}
    </div>
  );
}

/** A fact about the install rather than a setting: shown so the answer is here and not in a tooltip. */
function Fact(props: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-line px-4 py-2.5 first:border-t-0">
      <p className="text-sm text-muted">{props.label}</p>
      <p className="min-w-0 font-mono text-xs break-all text-fg">{props.value}</p>
    </div>
  );
}

const THEMES: readonly { value: ThemePref; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const GROUPS: readonly { value: GroupBy; label: string }[] = [
  { value: "project", label: "Project" },
  { value: "status", label: "Status" },
];

/** Everything Helicon lets you set, in one place: the menus around the app are shortcuts into this. */
export function SettingsPage() {
  const controller = useController();
  const prefs = useApp((s) => s.prefs);
  const models = useApp((s) => s.models);
  const titleSettings = useApp((s) => s.titleSettings);
  const sandboxSettings = useApp((s) => s.sandboxSettings);
  const env = useApp((s) => s.env);
  const updates = useApp((s) => s.updates);
  const bypassAll = useApp((s) => s.bypassAll);
  const armedThreads = useApp((s) => s.bypassThreads.length);
  const [confirmBypass, setConfirmBypass] = useState(false);
  const yoloSettings = useApp((s) => s.yoloSettings);
  const [confirmSandbox, setConfirmSandbox] = useState(false);
  const [confirmYolo, setConfirmYolo] = useState(false);
  const now = useNow(60_000);
  const busy = updates?.status === "checking" || updates?.status === "downloading" || updates?.status === "installing";
  const drag = useOverlayDragProps();
  const collapsed = useApp((s) => s.prefs.sidebarCollapsed);

  return (
    <div className="@container flex h-full min-w-0 flex-col">
      {collapsed ? <TopBar /> : null}
      <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
      <header {...drag} className="mx-auto flex w-full max-w-[720px] shrink-0 items-center gap-3 px-4 pt-8 pb-1 @min-[520px]:px-6">
        <Button size="sm" variant="ghost" onClick={() => controller.goBack()}>
          <ArrowLeft size={14} /> Back
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold text-fg">Settings</h1>
          <p className="text-xs text-muted">Kept on this device. Most settings leave running threads alone; the sandbox and YOLO switches restart Muse hosts at once.</p>
        </div>
      </header>

      <div className="mx-auto w-full min-w-0 max-w-[720px] px-4 pb-16 @min-[520px]:px-6">
        <BrowserSettingsSection />
        <Section title="Browser tools">
          <Row label="OS snapshot" description="Capture the screen into the composer with ⌘⇧S (desktop).">
            <p className="text-xs text-subtle">Requires the Helicon desktop app.</p>
          </Row>
        </Section>

        <Section title="Appearance">
          <Row label="Theme" description="Light, dark, or whatever this device is set to.">
            <Pick value={prefs.theme} options={THEMES} onChange={(value) => controller.setTheme(value)} />
          </Row>
          <Row label="Code" description="Colours for code and diffs, independent of the app's own theme.">
            <Pick
              value={prefs.codeTheme}
              options={CODE_THEMES.map((name) => ({ value: name as CodeTheme, label: CODE_THEME_LABELS[name] }))}
              onChange={(value) => controller.setCodeTheme(value)}
            />
          </Row>
          <Row
            label="Zoom"
            description={`How big the whole interface is. ${MOD} plus, ${MOD} minus and ${MOD} 0 adjust it anywhere; the percentage resets it.`}
          >
            <div className="flex items-center gap-1">
              <IconButton label="Zoom out" size="xs" onClick={() => controller.zoomOut()} disabled={prefs.zoom <= ZOOM_MIN}>
                <Minus size={14} />
              </IconButton>
              <button
                type="button"
                title="Reset zoom to 100%"
                onClick={() => controller.resetZoom()}
                className="h-6 min-w-11 rounded-md px-1.5 text-xs text-muted tabular-nums transition-colors duration-100 hover:bg-hover hover:text-fg"
              >
                {Math.round(prefs.zoom * 100)}%
              </button>
              <IconButton label="Zoom in" size="xs" onClick={() => controller.zoomIn()} disabled={prefs.zoom >= ZOOM_MAX}>
                <Plus size={14} />
              </IconButton>
            </div>
          </Row>
          <Row
            label="Session statistics"
            description="Telemetry pills above the composer: turns, speed and token usage for the open thread. Off by default."
          >
            <Toggle
              checked={prefs.showTelemetry}
              label="Session statistics"
              onChange={(on) => controller.setPrefs({ showTelemetry: on })}
            />
          </Row>
        </Section>

        <Section title="New threads">
          <Row label="Model" description="What a new thread starts on. Changing it here leaves running threads alone.">
            {models.length === 0 ? (
              <p className="text-xs text-subtle">No models loaded</p>
            ) : (
              <Pick
                value={prefs.defaultModelId}
                options={models.map((model) => ({
                  value: model.modelId,
                  // The contributor variants share a display name, so without this the list offers the same
                  // word twice and there is no way to tell which button is which.
                  label: model.contributor ? `${modelDisplayName(model.modelId)} · Contributor` : modelDisplayName(model.modelId),
                  hint: model.contributor ? "Contributor tier: prompts and outputs may be used for product improvement." : undefined,
                }))}
                onChange={(value) => void controller.setModel(value as string)}
              />
            )}
          </Row>
          <Row label="Permissions" description="What Muse may do before it asks you.">
            <div className="flex min-w-0 w-full flex-col items-end gap-1 @min-[520px]:w-auto">
              <Pick
                value={prefs.defaultMode}
                options={MODES.map((mode) => ({ value: mode.value as ApprovalMode, label: mode.label, hint: mode.description }))}
                onChange={(value) => void controller.setMode(value as ApprovalMode)}
                disabled={yoloSettings?.enabled === true}
              />
              {yoloSettings?.enabled ? (
                <p className="text-xs text-subtle">YOLO owns every thread&apos;s mode while it is on. Switch it off to choose.</p>
              ) : null}
            </div>
          </Row>
          <Row label="Reasoning effort" description="How long the model thinks before answering. Auto lets Muse choose per turn.">
            <Pick<ReasoningEffort | null>
              value={prefs.effort}
              options={[
                { value: null, label: "Auto", hint: "Muse picks the effort for each turn" },
                ...LEVELS.map((level) => ({ value: level.value, label: level.label, hint: level.description })),
              ]}
              onChange={(value) => controller.setEffort(value)}
            />
          </Row>
        </Section>

        <Section title="Threads list">
          <Row label="Group by" description="How the sidebar arranges threads.">
            <Pick value={prefs.groupBy} options={GROUPS} onChange={(value) => controller.setGroupBy(value)} />
          </Row>
        </Section>

        <Section title="Thread titles">
          <Row
            label="Generate titles"
            description="Name new threads with one cheap model call instead of echoing the first prompt, and rename up to 30 recent threads that still echo. The calls run on your Muse Code plan. Off keeps the echo and makes no calls at all."
          >
            {titleSettings ? (
              <Toggle
                checked={titleSettings.enabled}
                label="Generate titles"
                onChange={(on) => void controller.setTitleEnabled(on)}
              />
            ) : (
              <p className="text-xs text-subtle">Loading…</p>
            )}
          </Row>
          {titleSettings?.enabled ? (
            <Row label="Title model" description="Which model writes the titles. Muse default lets the CLI choose.">
              {models.length === 0 ? (
                <p className="text-xs text-subtle">No models loaded</p>
              ) : (
                <Pick<string | null>
                  value={titleSettings.modelId}
                  options={[
                    { value: null, label: "Muse default" },
                    ...models.map((model) => ({
                      value: model.modelId as string | null,
                      label: model.contributor ? `${modelDisplayName(model.modelId)} · Contributor` : modelDisplayName(model.modelId),
                      hint: model.contributor ? "Contributor tier: prompts and outputs may be used for product improvement." : undefined,
                    })),
                  ]}
                  onChange={(value) => void controller.setTitleModel(value)}
                />
              )}
            </Row>
          ) : null}
        </Section>

        <Section title="Approvals">
          <Row
            label="Answer approvals for me"
            description={
              bypassAll
                ? "Every request is allowed once, in every thread, without showing you the command. Off when Helicon closes."
                : "Muse asks whenever it cannot resolve a command, whatever its permission mode. This answers those for you, until Helicon closes."
            }
          >
            <Toggle
              checked={bypassAll}
              label="Answer approvals for me"
              onChange={(on) => (on ? setConfirmBypass(true) : controller.setBypassAll(false))}
            />
          </Row>
          {armedThreads > 0 ? (
            <Row label={`${armedThreads} thread${armedThreads === 1 ? "" : "s"} answering on their own`} description="Armed from an approval card.">
              <Button size="sm" variant="secondary" onClick={() => controller.clearThreadBypass()}>
                Ask again in all threads
              </Button>
            </Row>
          ) : null}
        </Section>

        <Section title="YOLO mode">
          <Row
            label="YOLO mode"
            description="Like muse --yolo: nothing asks for approval in any thread, new threads run without sandbox confinement, and workspaces are trusted. Existing threads keep the sandbox posture they started with. Flipping it restarts the running Muse hosts, interrupting their turns."
          >
            {yoloSettings ? (
              <Toggle
                checked={yoloSettings.enabled}
                label="YOLO mode"
                onChange={(on) => (on ? setConfirmYolo(true) : void controller.setYoloEnabled(false))}
              />
            ) : (
              <p className="text-xs text-subtle">Loading…</p>
            )}
          </Row>
        </Section>

        <Section title="Sandbox">
          <Row
            label="Disable sandboxing"
            description={
              yoloSettings?.enabled
                ? "Off because YOLO mode is on: YOLO already runs new threads without sandbox confinement. Switch YOLO off to control this separately."
                : "Muse's shells run sandboxed: filesystem and network access is confined. Switching this off lifts that confinement for new threads; existing threads keep the posture they started with. Flipping it restarts the running Muse hosts, interrupting their turns."
            }
          >
            {sandboxSettings ? (
              <Toggle
                checked={sandboxSettings.disabled}
                label="Disable sandboxing"
                disabled={yoloSettings?.enabled === true}
                onChange={(on) => (on ? setConfirmSandbox(true) : void controller.setSandboxDisabled(false))}
              />
            ) : (
              <p className="text-xs text-subtle">Loading…</p>
            )}
          </Row>
        </Section>

        <Section title="Notifications">
          <Row
            label="Tell me when a thread needs me"
            description="A system notification when a thread asks for approval, asks a question, finishes, fails, or its goal stops moving. Only while this window is in the background."
          >
            <Toggle
              checked={prefs.notifications}
              label="Notifications"
              // Switching on has to ask, and a browser only grants permission from a real press.
              onChange={(on) => (on ? void controller.askToNotify() : controller.setPrefs({ notifications: false }))}
            />
          </Row>
        </Section>

        {updates ? (
          <Section title="Updates">
            <Row label={`Helicon ${updates.currentVersion ?? ""}`} description={updateSummary(updates, prefs.autoUpdate, prefs.updatesPaused, now)}>
              <div className="flex flex-wrap items-center gap-2">
                {updates.status === "ready" ? (
                  <Button size="sm" variant="primary" onClick={() => controller.restartToUpdate()}>
                    <RotateCw size={13} /> Restart to update
                  </Button>
                ) : null}
                {updates.status === "available" ? (
                  <Button size="sm" variant="secondary" onClick={() => controller.downloadUpdate()}>
                    <ArrowDownToLine size={13} /> Download
                  </Button>
                ) : null}
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => controller.checkForUpdates()}>
                  <RefreshCw size={13} className={cn(updates.status === "checking" && "animate-spin")} /> Check now
                </Button>
              </div>
            </Row>
            {updates.error ? <Row label="Last error" description={updates.error} /> : null}
            <Row label="Automatic updates" description="Download new versions in the background and install them when Helicon closes.">
              <Toggle checked={prefs.autoUpdate} label="Automatic updates" onChange={(on) => controller.setAutoUpdate(on)} />
            </Row>
            <Row label="Pause updates" description="No checking, downloading or installing until you resume.">
              <Toggle checked={prefs.updatesPaused} label="Pause updates" onChange={(on) => controller.setUpdatesPaused(on)} />
            </Row>
          </Section>
        ) : null}

        <Section title="Environment">
          <Row label="What's new" description="The release notes for this version, as they appear after Helicon updates itself.">
            <Button size="sm" variant="secondary" onClick={() => controller.setWhatsNewOpen(true)}>
              <ScrollText size={13} /> Read
            </Button>
          </Row>
          <Fact label="Helicon" value={env?.version ?? "Unknown"} />
          <Fact label="Platform" value={env?.platform ?? "Unknown"} />
          {env?.platform === "win32" ? (
            <Fact
              label="Muse runs"
              value={env.runtime === "native" ? "Natively on Windows" : `In WSL${env.wslAvailable && env.defaultDistro ? ` (${env.defaultDistro})` : ""}`}
            />
          ) : null}
          <Fact label="Muse" value={env?.musePath ?? (env?.museFound ? "Found" : "Not found")} />
          <Fact label="Sessions" value={env?.persistent ? "Kept on disk" : "In memory only"} />
        </Section>
      </div>
      </div>

      <Modal
        open={confirmBypass}
        onOpenChange={setConfirmBypass}
        title="Answer approvals for you?"
        description="Every approval Muse raises, in any thread, is allowed once without showing you the command first. Muse asks about the commands it could not resolve, so these are the ones nothing else has checked. This lasts until you close Helicon."
      >
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmBypass(false)}>
            Keep asking
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setConfirmBypass(false);
              controller.setBypassAll(true);
            }}
          >
            Answer them for me
          </Button>
        </div>
      </Modal>

      <Modal
        open={confirmYolo}
        onOpenChange={setConfirmYolo}
        title="Turn on YOLO mode?"
        description="Like muse --yolo: nothing asks for approval in any thread, new threads run without sandbox confinement, and workspaces are trusted. The running Muse hosts restart, interrupting their turns, and threads already open keep the sandbox posture they started with. This stays on until you switch it off."
      >
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmYolo(false)}>
            Keep asking
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setConfirmYolo(false);
              void controller.setYoloEnabled(true);
            }}
          >
            Turn on YOLO
          </Button>
        </div>
      </Modal>

      <Modal
        open={confirmSandbox}
        onOpenChange={setConfirmSandbox}
        title="Disable Muse's sandbox?"
        description="New threads' shells will run without filesystem or network confinement, and the running Muse hosts restart, interrupting their turns. Threads already open keep their current confinement. Only do this in a disposable environment."
      >
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmSandbox(false)}>
            Keep the sandbox
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setConfirmSandbox(false);
              void controller.setSandboxDisabled(true);
            }}
          >
            Disable sandboxing
          </Button>
        </div>
      </Modal>
    </div>
  );
}
