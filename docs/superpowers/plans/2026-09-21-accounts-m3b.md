# Accounts M3b (visible UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the visible multi-account UI on top of the M3a data layer: a Settings accounts panel, a new-thread account picker, a sidebar account badge, per-account plan meters with a near-cap hint, the inherited-META_API_KEY warning, and in-app login.

**Architecture:** Every surface reuses Helicon's existing component vocabulary (Section/Row/Toggle/Modal/Menu/MenuOption/ToolbarTrigger/PlanMeter) and design tokens. The data plumbing already exists from M3a (`accounts`, `planUsageByAccount`, `defaultAccountId`, `accountId`, and the account controller methods); M3b consumes it and adds two small server endpoints (accounts health, in-app login) plus the client methods that reach them. New client methods land in all four HeliconClient implementations and are mirrored into `landing/src/product` by the sync script.

**Tech Stack:** TypeScript, React 19, Tailwind v4 (tokens on `:root`), radix-ui, lucide-react, `motion`, node:test, node:sqlite; `@harjjotsinghh/aonia` for profiles and login.

**Spec:** helicon#45 (multi-account), the M3b section of the aonia-muse-profiles project memory, and the verified M3a client/controller API in this repo.

## Global Constraints

Every task's requirements implicitly include this section. Copy the relevant lines into each dispatch brief verbatim.

- **Model policy:** N/A to the code, but the controller dispatches every implementer and reviewer on Sonnet (`model: "sonnet"`). Never Fable, never a fork.
- **Reuse, never invent.** Use only the primitives and tokens already in the repo. Never add a new CSS custom property or a raw hex color. If a value is needed, it already has a token. Icons come from `lucide-react` (the project's icon set); do not add another icon library.
- **Design tokens available:** `bg`, `raised`, `sunken`, `hover`, `active`, `line`, `line-strong`, `fg`, `muted`, `subtle`, `accent` (+`accent-text`/`accent-hover`/`accent-soft`/`accent-fg`), `warn` (+`warn-text`/`warn-soft`/`warn-line`), `danger` (+`danger-text`/`danger-soft`), `ok` (+`ok-text`). Text sizes include `text-2xs`, `text-md`. Shadows: `shadow-card`, `shadow-btn`, `shadow-pop`.
- **Copy rules (impeccable product register):** No em dashes anywhere in user-facing copy, and no `--`. Button labels are verb plus object: "Add account", "Log in", "Rename", "Remove account", "Set as default". Plain language, sentence case, no marketing words. Every sentence earns its place.
- **Contrast:** Body text at least 4.5:1 against its surface. Use `text-fg` for primary text and `text-muted` for secondary; never lighter than `text-subtle` for anything a user must read.
- **Motion:** Under 300ms, ease-out, and a `prefers-reduced-motion: reduce` path for anything that animates. Never animate a keyboard-triggered menu action. Menus and toggles already handle this through the shared primitives; do not add motion to them.
- **Banned patterns:** No side-stripe borders (a colored `border-left`/`border-right` wider than 1px), no gradient text, no glassmorphism, no card grids of identical tiles, no tiny uppercase tracked eyebrow above every element. Section titles already use the one sanctioned eyebrow style; do not add more.
- **Radius (concentric):** A Section is `rounded-2xl` (16px) and its inner interactive controls are `rounded-lg` (8px). Do not round cards past 16px. The `Button`/`IconButton` primitives already carry scale-on-press and 40px hit areas; do not re-add them.
- **No accounts, no change.** With zero profiles configured, every surface must look and behave exactly as it does today. New UI renders only when `accounts` has at least one entry (except the Settings Accounts section itself, which always shows so a user can add the first one).
- **Client parity.** Any new `HeliconClient` method must be added to all four implementations: the interface and web impl in `packages/ui/src/client.ts`, the `FakeClient` in `packages/ui/test/controller.test.ts`, and the `DemoClient` in `landing/src/demo/client.ts`. Then run `node landing/scripts/sync-product-ui.mjs` from the repo root to regenerate `landing/src/product/*`. Never hand-edit files under `landing/src/product`.
- **Tests must pass** for the package you touched before you report DONE: `npm test -w @helicon/ui`, `npm test -w @helicon/server`, and the landing check where relevant.

---

## Reference: the M3a data layer this plan consumes

Already merged; do not rebuild any of it.

**Types (`packages/ui/src/types.ts`):**
- `AccountView { id: string; name: string; hasLogin: boolean; email: string | null; lastUsedAt: string | null }`
- `PlanUsageByAccount = Record<string, PlanUsage>`
- `ProjectView.defaultAccountId: string | null`
- `SessionSummary.accountId: string | null`

**Client (`packages/ui/src/client.ts`):**
- `listAccounts(): Promise<AccountView[]>`
- `createAccount(id, options?: { name?; seedFromDefault? }): Promise<{ id; name }>`
- `renameAccount(id, name): Promise<void>`
- `removeAccount(id): Promise<void>`
- `setProjectDefaultAccount(cwd, accountId: string | null): Promise<void>`
- `startSession(cwd, options?: { approvalMode?; modelId?; accountId? })`
- `planUsage(): Promise<{ usage: PlanUsage | null; byAccount: PlanUsageByAccount }>`

**State (`packages/ui/src/model/store.ts`):**
- `accounts: AccountView[] | null` (null until first load)
- `planUsageByAccount: PlanUsageByAccount`
- `ComposerPicker = "model" | "effort" | "permissions" | "confirmFullAccess" | "confirmBypass" | "confirmYolo"`

**Controller (`packages/ui/src/model/controller.ts`):**
- `loadAccounts()`, `createAccount(id, name?, seedFromDefault?) -> boolean`, `renameAccount(id, name) -> boolean`, `removeAccount(id) -> boolean`, `setProjectDefaultAccount(cwd, accountId)`
- `loadPlanUsage()`, `takePlanUsage(usage, accountId?)`
- `startThread(cwd, ...)` at line ~1021 reads `project?.defaultAccountId ?? null` and passes it to `startSession`.

**Component vocabulary:**
- `packages/ui/src/components/settings/SettingsPage.tsx`: `Section({title, children})` (outer `section.mt-6` with an uppercase `text-2xs text-subtle` `h2`, inner `div.overflow-hidden.rounded-2xl.bg-raised.shadow-card`), `Row({label, description?, children?})` (`border-t border-line px-4 py-3 first:border-t-0`, label column `min-w-[13rem] flex-1 basis-64`), `Pick`, `Toggle` (radix Switch), `Fact`. The YOLO and Sandbox sections plus their confirm `Modal`s are the template for new sections and destructive confirms.
- `packages/ui/src/components/ui/overlays.tsx` exports `Menu`, `MenuTrigger`, `MenuContent`, `MenuLabel`, `MenuRadioGroup`, `MenuOption({value, icon?, label, description?, badge?, disabled?})`, `MenuItem`, `MenuSeparator`, `Modal({open, onOpenChange, title, description?, children})`, `Tip`.
- `packages/ui/src/components/ui/primitives.tsx` exports `Button`, `IconButton`, `Spinner`, `cn`, `MOD`.
- `packages/ui/src/components/composer/Composer.tsx`: `ModelPicker` (lines ~521-577) is the exact picker template: `Menu` bound to `useApp(s => s.picker === "model")`, `MenuTrigger asChild` wrapping the `ToolbarTrigger({icon, label, tone?})` at lines ~490-511, `MenuContent side`, `MenuLabel`, `MenuRadioGroup` of `MenuOption`. The toolbar row that hosts the pickers is at lines ~446-451: `<ModelPicker sessionId={props.sessionId} side={props.variant === "home" ? "bottom" : "top"} />`.
- `packages/ui/src/components/usage/PlanMeter.tsx`: `PlanMeter()` reads `useApp(s => s.planUsage)`, computes `planView(usage, now)` from `packages/ui/src/model/plan.ts`, and renders a `section.rounded-2xl.bg-raised.shadow-card` with a `@min-[520px]:grid-cols-2` grid of rows, each a labeled `role="progressbar"` bar with `FILL` tones and a `transition-[width] duration-300 ease-out` fill. `PlanPill()` is the sidebar-footer variant.
- `packages/ui/src/components/usage/UsagePage.tsx` renders `<PlanMeter />` near the top (imported at line 11).
- `packages/ui/src/components/sidebar/Sidebar.tsx`: `ThreadRow` (memo at ~604) renders the title row at lines ~642-655; the sandbox badge sits before the title as `session.sandboxDisabled === true ? <span className="flex shrink-0 text-warn-text"><ShieldOff size={12} /></span> : null`. The memo comparator (~690) compares `a.entry.session === b.entry.session` by reference.
- `packages/ui/src/components/home/Home.tsx`: `NewThread({cwd})` at line 15 renders `<Composer sessionId={null} cwd={project.cwd} variant="home" />` at line 43 and `ProjectSwitcher` at line 71.

**Server (`packages/server/src/server.ts`):**
- Account routes at lines ~1412-1470 use `this.aonia.createProfile/renameProfile/removeProfile` and `this.accountList()` (~2862, builds `{id, name, hasLogin, email, lastUsedAt}` from `identityOf`). `accountError` (~2878) maps `profile_exists` to 409 else 400. `HttpError`, `str`, `readBody`, `json` helpers exist.
- The aonia instance is `this.aonia: Aonia` (created ~692). It exposes `getProfile(id)`, `loginCommand(profile): Command {command, args, env}`, `identityOf(profile)`, `envFor(profile)`, `doctor(): Promise<Finding[]>`.
- `spawn` is imported from `node:child_process` (line 1). Muse resolution helpers: `cliMusePath()` (~1991), `museRuntime()`, `planMuseCli` (~2031). The child env must be `{ ...process.env, ...command.env }` because the SDK/spawn replaces the child environment.
- `aonia.loginCommand(profile)` returns `{ command: <musePath>, args: ["login"], env: <overlay> }`. `parseLoginOutput(text): { url: string | null; code: string | null }` is exported from `@harjjotsinghh/aonia`.

---

## Task 1: Settings Accounts panel (management, no login yet)

**Files:**
- Modify: `packages/ui/src/components/settings/SettingsPage.tsx`

**Interfaces:**
- Consumes: `useApp(s => s.accounts)`, `controller.loadAccounts()`, `controller.createAccount(id, name?, seedFromDefault?)`, `controller.renameAccount(id, name)`, `controller.removeAccount(id)`. All exist.
- Produces: an `<Section title="Accounts">` rendered inside the settings body, placed directly after the "New threads" section and before "Threads list" (accounts are about identity, which pairs with new threads).

**Design:**
- Reuse `Section` and `Row`. Each account is a `Row` whose `label` is the account name and whose `description` is the sign-in state: the email when `hasLogin` and an email exist, "Signed in" when `hasLogin` with no email, or "Not signed in" otherwise. The `Row` children hold the per-account actions.
- Per-account actions, as small `Button size="sm" variant="secondary"`/`"ghost"`: "Rename" and "Remove account". (The "Log in" button is added in Task 6; leave a comment marking where it goes.) "Remove account" uses `variant="danger"` styling only inside its confirm modal, not in the row.
- Section intro: a leading `Row`-free paragraph is not the pattern; instead the first `Row` can carry the description. Put a one-line explanation under the section by rendering a `<p className="mb-2 ...">` is also not the pattern. Follow the existing sections: the explanation lives in the first `Row`'s `description`, or use the header paragraph pattern the page uses at the top. Simplest: an "Add account" `Row` at the top whose `description` is "Separate logins for work, personal, or a client. Each runs under its own Muse profile." and whose child is the "Add account" button.
- Empty state: when `accounts` is an empty array, show only the "Add account" row (its description already invites the action). When `accounts` is `null`, show a single `Row` with `<p className="text-xs text-subtle">Loading…</p>` (matches the sandbox/YOLO loading text).
- Add flow: an "Add account" `Button size="sm" variant="secondary"` opens a `Modal`. The modal body has two labeled text inputs (id, name) and a `Toggle`-free checkbox is not available; use a `Toggle` row for "Copy settings from the default login" bound to a local `seedFromDefault` state. Validate the id locally only for emptiness; the server enforces the slug rule and its 400 message surfaces as the controller's error toast. On submit call `controller.createAccount(id, name || undefined, seedFromDefault)`; close the modal only when it returns `true`.
- Rename flow: a `Modal` with a single text input pre-filled with the current name; submit calls `controller.renameAccount(id, name)` and closes on `true`.
- Remove flow: a confirm `Modal` (title "Remove this account?", description explaining that the profile's local settings are deleted and any threads that used it keep running under it until they end), with a `Button variant="danger"` labeled "Remove account" calling `controller.removeAccount(id)`.
- Inputs use the same visual language as the rename field elsewhere: `className="h-9 w-full rounded-lg border border-line bg-sunken px-3 text-sm text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent"`. Labels are `<label className="text-xs font-medium text-muted">` above each input with `gap-1.5`.
- Load on mount: add a `useEffect(() => { void controller.loadAccounts(); }, [controller])` in the settings component (mirrors how `PlanMeter` calls `loadPlanUsage` on mount) so opening Settings refreshes the list.

**Steps:**

- [ ] **Step 1: Add the accounts state selector and the section scaffold.** In `SettingsExperience` (the main settings component), add `const accounts = useApp((s) => s.accounts);` beside the other `useApp` selectors, add the mount `useEffect` for `loadAccounts`, and add local state: `const [addOpen, setAddOpen] = useState(false)`, `const [renaming, setRenaming] = useState<AccountView | null>(null)`, `const [removing, setRemoving] = useState<AccountView | null>(null)`. Render an empty `<Section title="Accounts">` after the "New threads" section.

- [ ] **Step 2: Render the account rows and the add row.** Inside the section, render the "Add account" row first, then map `accounts` to a `Row` per account with the sign-in description and the "Rename"/"Remove account" buttons wired to `setRenaming`/`setRemoving`. Handle `accounts === null` (Loading) and `accounts.length === 0` (add row only).

- [ ] **Step 3: Build the Add modal.** A local `AddAccountModal` component (or inline `Modal`) with id/name inputs, the seed toggle, and a submit `Button variant="primary"` labeled "Add account". Disable submit while the id is blank. On success (`createAccount` returns `true`) reset the fields and close.

- [ ] **Step 4: Build the Rename and Remove modals.** Rename modal with a prefilled name input and "Rename" primary button. Remove modal with the danger confirm. Both close only on a truthy controller result (remove/rename return `boolean`).

- [ ] **Step 5: Verify types and imports.** Add `AccountView` to the `types.js` import. Ensure no unused imports. Run `npm run -w @helicon/ui typecheck` (or the package's build) and the UI tests.

- [ ] **Step 6: Run the UI tests.** `npm test -w @helicon/ui`. Expected: PASS (no test changes required; this is presentational).

- [ ] **Step 7: Commit.** `feat(ui): settings accounts panel`

---

## Task 2: New-thread account picker in the composer toolbar

**Files:**
- Modify: `packages/ui/src/components/composer/Composer.tsx`

**Interfaces:**
- Consumes: `useApp(s => s.accounts)`, the project's `defaultAccountId` via `useApp(s => s.projects.find(p => p.cwd === cwd)?.defaultAccountId ?? null)`, `controller.setProjectDefaultAccount(cwd, accountId)`. All exist.
- Produces: an `AccountPicker` rendered in the composer toolbar row next to `ModelPicker`.

**Design and behavior (ruling):**
- The picker sets the project's default account, persisted through the existing `setProjectDefaultAccount`. `startThread` already reads `project.defaultAccountId`, so a pick takes effect on the next new thread with no new state. This is the #45 "new threads default to the project's account" behavior with an override in one control. Record this ruling in the ledger.
- Render the picker only on the new-thread composer and only when accounts exist: `if (props.sessionId !== null || !props.cwd || !(accounts && accounts.length > 0)) return null;`. On existing threads the account is fixed at spawn and shown by the sidebar badge (Task 3), so the picker does not appear there.
- Reuse the `ModelPicker` structure exactly: a `Menu` bound to a new `ComposerPicker` value `"account"`, a `MenuTrigger asChild` wrapping `ToolbarTrigger({ icon: <UserRound size={13} />, label })`, and a `MenuContent side={props.variant === "home" ? "bottom" : "top"}` with a `MenuLabel` "Account" and a `MenuRadioGroup`.
- Options: a first `MenuOption value="" label="Default login"` (the null account), then one `MenuOption` per account with `label={account.name}` and `description={account.hasLogin ? (account.email ?? "Signed in") : "Not signed in"}`. `value={current ?? ""}`. `onValueChange={(value) => void controller.setProjectDefaultAccount(props.cwd as string, value || null)}`.
- Trigger label: the current account's name, or "Default login" when null. Truncate long names (the `ToolbarTrigger` label already truncates).

**Steps:**

- [ ] **Step 1: Extend the picker union.** In `packages/ui/src/model/store.ts`, add `"account"` to `ComposerPicker`: `... | "confirmYolo" | "account"`. (The controller `setPicker`/`closePicker` already accept any `ComposerPicker`.)

- [ ] **Step 2: Write the `AccountPicker` component.** Add it beside `ModelPicker` in `Composer.tsx`, following the `ModelPicker` template. Import `UserRound` from `lucide-react`. Guard with the render conditions above.

- [ ] **Step 3: Mount it in the toolbar.** In the toolbar row (after `<AccessPicker ... />` at line ~451), add `<AccountPicker sessionId={props.sessionId} cwd={props.cwd} variant={props.variant} />`. The component itself returns null when it should not show, so no conditional is needed at the call site.

- [ ] **Step 4: Typecheck and test.** Run `npm test -w @helicon/ui`. Expected: PASS.

- [ ] **Step 5: Commit.** `feat(ui): new-thread account picker`

---

## Task 3: Sidebar account badge

**Files:**
- Modify: `packages/ui/src/components/sidebar/Sidebar.tsx`

**Interfaces:**
- Consumes: `session.accountId` (already on `SessionSummary`), `useApp(s => s.accounts)` for the name lookup.
- Produces: an `AccountBadge` component rendered in `ThreadRow`'s title row.

**Design:**
- A small neutral chip, distinct from the warn-styled `ShieldOff`: `<span className="shrink-0 rounded bg-active px-1 py-px text-2xs font-medium text-muted">` showing the account name, truncated with `max-w-[7rem] truncate` inside. This matches the PlanMeter tier chip idiom, not the ContributorBadge warn idiom, because an account is neutral information, not a warning.
- `AccountBadge` is its own component with its own `useApp(s => s.accounts)` subscription so it re-renders when an account is renamed, independent of the `ThreadRow` memo (which compares `entry.session` by reference and would otherwise show a stale name). It renders `null` when `accountId` is null or the account is not found.
- Place it in the title row right after the `ShieldOff` slot and before the title span (`packages/ui/src/components/sidebar/Sidebar.tsx` ~653). Add a matching `sr-only` mention alongside the existing sandbox one so screen readers announce the account.

**Steps:**

- [ ] **Step 1: Write `AccountBadge`.** `function AccountBadge({ accountId }: { accountId: string | null }) { const account = useApp((s) => s.accounts?.find((a) => a.id === accountId) ?? null); if (!accountId || !account) return null; return (<span title={`Account: ${account.name}`} className="...">{account.name}</span>); }`. Truncate the name.

- [ ] **Step 2: Render it in `ThreadRow`.** Add `<AccountBadge accountId={session.accountId} />` immediately after the `ShieldOff` conditional in the title-row span. Extend the `sr-only` string to include `${session.accountId ? `, account ${...}` : ""}` (look up the name; if the lookup is awkward in the sr-only string, a plain ", using a separate account" is acceptable and avoids a second subscription).

- [ ] **Step 3: Test.** `npm test -w @helicon/ui`. Expected: PASS. The `RowMeta`/memo tests should be unaffected because the badge is an independent subscriber.

- [ ] **Step 4: Commit.** `feat(ui): sidebar account badge`

---

## Task 4: Per-account plan meters and the near-cap hint

**Files:**
- Modify: `packages/ui/src/components/usage/PlanMeter.tsx`
- Modify: `packages/ui/src/components/usage/UsagePage.tsx`
- Modify: `packages/ui/src/components/home/Home.tsx`

**Interfaces:**
- Consumes: `useApp(s => s.planUsageByAccount)`, `useApp(s => s.accounts)`, `planView(usage, now)` from `model/plan.ts`.
- Produces: a reusable meter card, a per-account meter grid on the Usage page, and a one-line near-cap hint on the new-thread screen.

**Design:**
- Refactor `PlanMeter.tsx`: extract the presentational card body (the header with the tier chip and the rows grid) into an internal `MeterCard({ view, title, now })` that takes a `PlanView` and a title. `PlanMeter()` keeps reading `s.planUsage` and renders `MeterCard` with the title "Plan usage" (its current copy). This keeps the default meter identical to today.
- Add an exported `AccountMeters()` component: reads `accounts` and `planUsageByAccount`, and for each account that has an entry in `planUsageByAccount`, renders a `MeterCard` titled with the account name. Render nothing when there are no per-account entries (so a single-account or no-account setup shows only the default meter). Lay the cards out in a `grid gap-3 @min-[720px]:grid-cols-2` so two accounts sit side by side on a wide usage page and stack on a narrow one. Do not wrap them in extra cards; each `MeterCard` is already a `rounded-2xl bg-raised shadow-card` section.
- `UsagePage.tsx`: below the existing `<PlanMeter />`, render `<AccountMeters />` inside the same container. Keep the existing spacing rhythm (the `PlanMeter` sits in a wrapper with bottom margin; give `AccountMeters` the same).
- Near-cap hint (`Home.tsx` `NewThread`): a single muted line rendered under the composer, shown only when: there are at least two accounts, the project's default account (or the default login) has a rolling-window percent at or above 80, and another account's rolling-window percent is at least 25 points lower. Copy: `"{highName} is at {highPct}%. {lowName} has more room, at {lowPct}%."` No em dashes. Use `planView(planUsageByAccount[id], now)?.rows[0]?.percent` for each; skip accounts with no usage. Style: `<p className="mt-2 text-xs text-muted">`. This is the manual "Personal is at 94%, Work is at 12%" suggestion from the spec, shown, never acted on automatically.

**Steps:**

- [ ] **Step 1: Extract `MeterCard`.** Move the loaded-state JSX of `PlanMeter()` into `function MeterCard({ view, title, now }: { view: PlanView; title: string; now: number })`. `PlanMeter()` computes its `view` and `now` as today and returns either the empty-state section (unchanged) or `<MeterCard view={view} title="Plan usage" now={now} />`. Verify the default meter renders identically.

- [ ] **Step 2: Add `AccountMeters`.** Export a component that maps accounts-with-usage to `MeterCard`s using `planView(planUsageByAccount[account.id], now)`, titled by account name, with the reduced-motion-safe `useNow(60_000, ...)` clock the file already uses. Return `null` when nothing to show.

- [ ] **Step 3: Wire the Usage page.** Import and render `<AccountMeters />` under `<PlanMeter />` in `UsagePage.tsx`.

- [ ] **Step 4: Add the near-cap hint to `NewThread`.** Compute the two candidate percentages, render the single line only when the threshold is met. Keep it out of the DOM entirely otherwise.

- [ ] **Step 5: Test.** `npm test -w @helicon/ui`. Expected: PASS.

- [ ] **Step 6: Commit.** `feat(ui): per-account plan meters and near-cap hint`

---

## Task 5: Inherited META_API_KEY warning (server health, client, controller, Settings banner)

**Files:**
- Modify: `packages/server/src/server.ts`
- Modify: `packages/ui/src/client.ts`
- Modify: `packages/ui/src/model/store.ts`
- Modify: `packages/ui/src/model/controller.ts`
- Modify: `packages/ui/src/components/settings/SettingsPage.tsx`
- Modify: `packages/ui/test/controller.test.ts` (FakeClient)
- Modify: `landing/src/demo/client.ts` (DemoClient)
- Test: `packages/server/test/*` (add a case near the existing accounts tests)

**Interfaces:**
- Produces: `GET /api/accounts/health -> { metaApiKeyInherited: boolean }`; `HeliconClient.accountsHealth(): Promise<{ metaApiKeyInherited: boolean }>`; `AppState.metaApiKeyInherited: boolean`; a `controller.loadAccountsHealth()` called from `loadAccounts`.
- Consumes: `this.aonia.doctor()` on the server, which returns `Finding[]`; the finding with code `meta_api_key_inherited` (verify the exact code string in the installed aonia's doctor output; it is the finding aonia raises when `META_API_KEY` is present in the environment). If the exact code differs, match on the code aonia actually emits and note it in the report.

**Server:**
- Add a route: `if (method === "GET" && path === "/api/accounts/health") { const findings = await this.aonia.doctor(); const inherited = findings.some((f) => f.code === "meta_api_key_inherited"); this.json(res, 200, { metaApiKeyInherited: inherited }); return true; }`. Place it beside the other `/api/accounts` routes. If `doctor()` is expensive, it is still only called when Settings loads; acceptable.

**Client (all four impls + sync):**
- Interface + web impl in `packages/ui/src/client.ts`: `accountsHealth(): Promise<{ metaApiKeyInherited: boolean }>` doing `this.get("/api/accounts/health")` (follow the existing GET helper pattern in the web impl).
- `FakeClient` in `packages/ui/test/controller.test.ts`: return `{ metaApiKeyInherited: false }` by default; allow a test to override.
- `DemoClient` in `landing/src/demo/client.ts`: return `{ metaApiKeyInherited: false }`.
- Run `node landing/scripts/sync-product-ui.mjs` from the repo root.

**State + controller:**
- `store.ts`: add `metaApiKeyInherited: boolean` to `AppState` (default `false` in `initialState`).
- `controller.ts`: add `async loadAccountsHealth(): Promise<void>` that calls `this.client.accountsHealth()` and updates the flag, swallowing errors (a server without the route leaves it false). Call it from `loadAccounts()` (fire and forget, after the list loads) so opening Settings refreshes both.

**Settings banner:**
- In the Accounts section, when `metaApiKeyInherited` is true, render a leading `Row` with a warn treatment: `label="Accounts share one login"`, `description="META_API_KEY is set in Helicon's environment. Every account inherits it, so they all use the same Meta login. Unset it in your environment to keep accounts separate."`. Give the row a warn accent by putting a `<TriangleAlert size={14} className="text-warn-text" />` in the label area, or render the description text in `text-warn-text`. Do not use a side-stripe border. Keep it inside the section, above the account rows.

**Steps:**

- [ ] **Step 1: Server route + test.** Add the `/api/accounts/health` route. Add a server test that stubs the injected aonia's `doctor()` to include and exclude the finding, asserting the JSON both ways. Run `npm test -w @helicon/server`.

- [ ] **Step 2: Client method in all four impls.** Add to the interface and web impl, the FakeClient, and the DemoClient. Run the sync script. Confirm `landing/src/product/client.ts` now carries the method.

- [ ] **Step 3: State + controller.** Add the state field and `loadAccountsHealth`, call it from `loadAccounts`. Add or extend a controller test asserting the flag flips when the fake reports it.

- [ ] **Step 4: Settings banner.** Render the warn row when the flag is true.

- [ ] **Step 5: Full test.** `npm test -w @helicon/ui` and `npm test -w @helicon/server`. Expected: PASS.

- [ ] **Step 6: Commit.** `feat(accounts): warn when META_API_KEY makes accounts share a login`

---

## Task 6: In-app login

**Files:**
- Modify: `packages/server/src/server.ts`
- Modify: `packages/ui/src/client.ts`
- Modify: `packages/ui/src/model/store.ts`
- Modify: `packages/ui/src/model/controller.ts`
- Modify: `packages/ui/src/components/settings/SettingsPage.tsx`
- Modify: `packages/ui/test/controller.test.ts` (FakeClient)
- Modify: `landing/src/demo/client.ts` (DemoClient)
- Test: `packages/server/test/*`

**Interfaces:**
- Produces: `POST /api/accounts/:id/login -> { url: string; code: string | null } | { fallback: string }`; `HeliconClient.loginAccount(id): Promise<{ url: string; code: string | null } | { fallback: string }>`; controller `beginLogin(id)` with a device-prompt state; a per-account "Log in" button and a device-code modal in Settings.
- Consumes: `this.aonia.getProfile(id)`, `this.aonia.loginCommand(profile)`, `parseLoginOutput` (imported from `@harjjotsinghh/aonia`), the server's muse runtime check, `spawn` from `node:child_process`, and `controller.loadAccounts()` for polling completion.

**Server (`POST /api/accounts/:id/login`):**
- Guard the runtime: if the muse runtime is WSL (reuse the `museRuntime()` check the server already has for Windows), return `200 { fallback: "In-app login is not available when Muse runs in WSL. Log in from a terminal with: aonia login <id>." }` with the id filled in. This keeps WSL passthrough deferred, matching M2/M3.
- Resolve the id: `const profile = await this.aonia.getProfile(id)` inside try/catch, mapping failure through `this.accountError(error)`.
- Build the command: `const command = this.aonia.loginCommand(profile)`. Resolve the executable through the server's own muse path if `command.command` is the bare default and the server has a configured path; otherwise use `command.command`. (Native macOS/Linux: the bare or configured path is correct.)
- Spawn: `const child = spawn(resolved, command.args, { cwd: os.homedir?, env: { ...process.env, ...command.env }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true })`. Accumulate `stdout` (and `stderr`, since the device prompt may print there). On each chunk run `parseLoginOutput(accumulated)`; when it yields a `url`, resolve the request with `{ url, code }` and stop reading (leave the child running so the user can complete the login; it exits on its own when the login finishes or times out).
- Track in-flight logins in a `Map<string, ChildProcess>` keyed by account id: if one is already running for this id, kill it before starting a new one (a user who reopens the modal should not stack processes). Reap the child on `close`, removing it from the map.
- Timeout: if no url appears within, say, 30 seconds, kill the child and return `500`/`HttpError(504, "Muse did not return a sign-in link.")`.
- The whole read-until-url is a `Promise<{url, code}>` the route awaits; wrap so a child error rejects it.

**Client (all four impls + sync):**
- Interface + web impl: `loginAccount(id: string): Promise<{ url: string; code: string | null } | { fallback: string }>` doing a POST to `/api/accounts/${encodeURIComponent(id)}/login`.
- FakeClient: resolve `{ url: "https://auth.meta.com/oauth/device/?code=TEST-CODE", code: "TEST-CODE" }` by default; let a test override to exercise the fallback and the poll.
- DemoClient: resolve `{ fallback: "In-app login is not available in the demo." }` (the landing demo has no real Muse).
- Run the sync script.

**State + controller:**
- `store.ts`: add `login: { accountId: string; url: string; code: string | null; status: "pending" | "waiting" | "done" } | { accountId: string; fallback: string } | null` (name it `accountLogin`). Default `null`.
- `controller.ts`: `async beginLogin(id)`: set `accountLogin` to a pending marker, call `client.loginAccount(id)`. If it returns a `fallback`, store the fallback shape. Otherwise store `{ accountId, url, code, status: "waiting" }` and start polling: every 2 seconds call `loadAccounts()` and check whether the account's `hasLogin` is now true; when it flips, set status "done", stop polling, and clear the marker shortly after (or leave the modal to close itself). Stop polling after a bounded number of attempts (e.g. 60, two minutes) and on modal close. Add `cancelLogin()` that clears the marker and stops the poll.
- Do not leak intervals: store the timer on the controller and clear it in `cancelLogin`, on completion, and if `beginLogin` is called again.

**Settings UI:**
- In each account `Row`, when `!account.hasLogin`, render a `Button size="sm" variant="secondary"` labeled "Log in" calling `controller.beginLogin(account.id)`. When `hasLogin`, show nothing extra (the description already shows the email).
- Device-code modal, driven by `accountLogin`: a `Modal` open when `accountLogin?.accountId` matches. For the `fallback` shape, show the fallback text and a single "Close" button. For the device shape, show the code prominently (`<code className="... text-lg tabular-nums ...">{code}</code>` when present), the instruction "Open the sign-in page and enter this code.", a primary `Button` "Open sign-in page" that opens `url` (use the controller's existing external-open path if one exists, for example `controller.openExternal(url)`; if none exists, an anchor `<a href={url} target="_blank" rel="noreferrer">` styled as a button is acceptable and avoids adding a client method), and a note that the window updates when sign-in completes. When `status === "done"`, show a brief "Signed in" confirmation and auto-close. Closing the modal calls `controller.cancelLogin()`.
- Never render the url as raw clickable text without the safety of a plain external open; the url is Meta's own device page, but keep it a single deliberate button.

**Steps:**

- [ ] **Step 1: Server route + test.** Implement the route with the in-flight map, the WSL fallback, the parse-until-url promise, and the timeout. Add a server test that injects a fake aonia and a fake spawner (follow the existing `hostFactory`/injection pattern the server tests use) feeding staged stdout, asserting the `{url, code}` result, the fallback on the WSL runtime, and that a second call for the same id replaces the first child. Run `npm test -w @helicon/server`.

- [ ] **Step 2: Client method in all four impls + sync.** Add to interface, web impl, FakeClient, DemoClient; run the sync script.

- [ ] **Step 3: State + controller + test.** Add `accountLogin` state, `beginLogin`, `cancelLogin`, the bounded poll. Add a controller test using the FakeClient: `beginLogin` sets the waiting state, the poll flips to done once the fake's `listAccounts` reports `hasLogin`, and `cancelLogin` clears it and the timer.

- [ ] **Step 4: Settings login button + device modal.** Wire the button and the modal to the state.

- [ ] **Step 5: Full test.** `npm test -w @helicon/ui` and `npm test -w @helicon/server`. Expected: PASS.

- [ ] **Step 6: Commit.** `feat(accounts): in-app login with a device code`

---

## Task 7: Landing parity and whole-repo verification

**Files:**
- Modify (generated): `landing/src/product/*` via the sync script
- Verify only: the whole build and test surface

**Steps:**

- [ ] **Step 1: Re-run the sync.** `node landing/scripts/sync-product-ui.mjs` from the repo root. Confirm `git status` shows only expected `landing/src/product` changes and that they match the ui-side source (the script is the source of truth; never hand-edit).

- [ ] **Step 2: Build every workspace.** Run the repo's build (`npm run build` or the per-workspace builds the CI uses: daemon, server, ui, web, landing, and the desktop bundle step). Fix any type errors surfaced by the new methods and state.

- [ ] **Step 3: Full test run.** `npm test -w @helicon/daemon`, `npm test -w @helicon/server`, `npm test -w @helicon/ui`, `npm test -w @helicon/web`, and the landing check. Record the counts.

- [ ] **Step 4: Commit.** `chore(landing): sync product UI for accounts M3b`

---

## Self-review notes

- **Spec coverage:** Settings panel (Task 1, 5, 6), new-thread picker (Task 2), sidebar badge (Task 3), per-account meters and near-cap hint (Task 4), META_API_KEY warning (Task 5), in-app login (Task 6). All #45 M3b surfaces covered.
- **No new tokens or icons:** every color is an existing token; every icon is lucide-react.
- **Client parity:** Tasks 5 and 6 each add one client method to all four impls and run the sync; Task 7 verifies the mirror.
- **Second Muse account:** needed only to exercise Task 6 end to end and to see real per-account meters. The code, its unit tests, and Tasks 1 to 5 do not need it. The controller (session owner) will run the app locally after the build and hand the user the preview before merge.
