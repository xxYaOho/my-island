# OpenCode CLI Follow-Up Slice Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship the next real OpenCode lifecycle slice so `uninstall --platform opencode` and `upgrade --platform opencode` do meaningful, safe work on top of the already-complete install slice, while `README.md` becomes a real new-device Quick Start.

**Architecture:** Preserve the current seam of `src/cli.ts` -> `src/commands/*.ts` -> `src/platforms/opencode.ts` -> `src/lib/*.ts`. Add only the minimum lifecycle structure needed for safe follow-up work: a small install-state record inside bonfire runtime, deterministic legacy-install detection, and conservative command behavior that never turns `bonfire` into a public surface or overwrites user-authored bonfire content.

**Tech Stack:** TypeScript, Node built-ins (`node:test`, `node:assert/strict`, `node:fs`, `node:path`, `node:os`, `node:child_process`, `node:crypto` only if needed for stable file fingerprints), `tsx --test`, existing scripts in `package.json`.

---

## Scope Locks

- This plan starts after the already-verified slice-1 install work. Do not re-plan or re-implement slice 1.
- Public commands remain exactly:
  - `bunx github:teatin/my-island install --platform opencode`
  - `bunx github:teatin/my-island uninstall --platform opencode`
  - `bunx github:teatin/my-island upgrade --platform opencode`
- `bonfire` stays internal to install lifecycle. Do not add a public `bonfire` top-level command.
- Keep scope on OpenCode only. Do not widen into Claude Code, Cursor, or general multi-platform abstractions.
- Keep `my-island` as the product surface and `bonfire` as an internal facility.
- Preserve room for a later TUI, but do not add TUI work in this slice.
- Do not redesign the adapter architecture, system glue, or broader capability layer.

## Decisions Locked For This Slice

- `uninstall --platform opencode` is safe-first, not destructive-first.
- `uninstall` must remove both bonfire and adapter only when the install can be identified as my-island-managed.
- If lifecycle ownership is unclear, `uninstall` must fail with a clear message and make no filesystem changes.
- `upgrade --platform opencode` is a conservative lifecycle refresh, not a migration engine.
- `upgrade` must backfill install-state metadata, repair missing template scaffolding, and refresh the adapter deployment without overwriting user-authored bonfire files.
- `upgrade` must fail clearly when there is no recognizable bonfire installation to upgrade.
- README work must stay in Chinese prose to match repo documentation rules, but all command examples must use the exact public CLI syntax.

## Safety Model To Implement

- Add a runtime state file at `runtime/my-island-install.json` inside the bonfire instance.
- Fresh `install` must write that state file after the existing copy/deploy steps succeed.
- `upgrade` must write or refresh that state file for both fresh and legacy installs.
- `uninstall` must prefer the runtime state file for ownership detection.
- If the state file is missing, `uninstall` may fall back to a legacy heuristic only when the bonfire tree still matches the shipped `templates/bonfire/**` file set exactly.
- A bonfire with extra files, changed tracked files, or missing core template directories is not safe to auto-remove in this slice.
- Adapter ownership must be treated as managed only when the deployed plugin file matches the my-island adapter signature rules defined in this slice.

## Exact Files Expected In This Slice

**Create:**
- `src/lib/install-state.ts`
- `tests/opencode-uninstall.test.ts`
- `tests/opencode-upgrade.test.ts`
- `tests/readme-quickstart.test.ts`

**Modify:**
- `README.md`
- `src/commands/install.ts`
- `src/commands/uninstall.ts`
- `src/commands/upgrade.ts`
- `src/platforms/opencode.ts`
- `src/lib/fs.ts`
- `src/lib/paths.ts`
- `tests/cli-surface.test.ts`
- `tests/opencode-install.test.ts`

## Explicit Deferrals

- Any public `bonfire` command surface
- TUI onboarding, TUI confirmations, or TUI lifecycle management
- Claude Code or Cursor adapters
- Heavy migration logic for existing bonfire content
- Background daemons, orchestration, system-glue implementation, or capability-layer expansion
- A destructive override flag such as `--force`; if later needed, plan it in a dedicated future slice after lifecycle metadata is established

## Rollout Order

1. Lock lifecycle ownership rules with failing tests before touching real uninstall/upgrade code.
2. Add the smallest shared lifecycle helper layer and backfill install-state writing into `install`.
3. Implement safe uninstall around managed-install detection.
4. Implement conservative upgrade around adapter refresh + missing-template repair + metadata backfill.
5. Tighten top-level CLI coverage so command behavior matches the new lifecycle rules.
6. Rewrite `README.md` into a copy-pasteable new-device Quick Start and test the docs surface.
7. Run full validation and only then prepare for Atlas execution or follow-up review.

## Ultrawork / Execution Notes

- Keep one executor on `src/platforms/opencode.ts` at a time; uninstall, upgrade, and install-state backfill all converge there.
- Safe parallelism only starts after the shared lifecycle helper exists:
  - one executor can own command/platform/test work
  - another can draft the README Quick Start and README test after command output text is settled
- Reuse the existing temp-fixture pattern from `tests/cli-surface.test.ts` and `tests/opencode-install.test.ts`.
- Never run tests against the real `~/.config/opencode/plugins/` or the real `~/.local/share/bonfire`; every test must override `HOME` and `BONFIRE_DIR`.
- Every commit in this plan must pass at least the task-local test command before commit, and the final commit must pass `npm run validate`.

## Atomic Commit Strategy

1. `feat(opencode): persist install state`
2. `feat(opencode): add safe uninstall`
3. `feat(opencode): add conservative upgrade`
4. `test(cli): cover lifecycle commands`
5. `docs(readme): add opencode quick start`

## Task 1: Persist lifecycle ownership state during install

**Files:**
- Create: `src/lib/install-state.ts`
- Modify: `src/lib/fs.ts`
- Modify: `src/lib/paths.ts`
- Modify: `src/platforms/opencode.ts`
- Test: `tests/opencode-install.test.ts`

**Step 1: Write the failing install-state tests**

Extend `tests/opencode-install.test.ts` with focused cases that prove fresh installs now stamp lifecycle metadata and expose the helper boundary you will rely on later:

```ts
test('install writes runtime/my-island-install.json for a fresh bonfire', async () => {
  const fixture = createFixture()

  try {
    const result = await installOpencode({
      cwd: repoRoot,
      env: { BONFIRE_DIR: fixture.bonfireDir },
      homeDir: fixture.homeDir,
    })

    assert.equal(result.ok, true)

    const statePath = path.join(fixture.bonfireDir, 'runtime', 'my-island-install.json')
    assert.equal(fs.existsSync(statePath), true)

    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'))
    assert.equal(state.schemaVersion, 1)
    assert.equal(state.platform, 'opencode')
    assert.equal(state.bonfireDir, fixture.bonfireDir)
    assert.equal(state.pluginPath, fixture.pluginPath)
    assert.equal(state.templateFiles.includes('README.md'), true)
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true })
  }
})
```

Add one helper-level case too:

```ts
test('install state helper treats extra legacy files as unsafe for auto-removal', () => {
  // create a template-shaped bonfire, add memory/user-note.md,
  // then assert the helper returns false for legacy-safe removal.
})
```

**Step 2: Run test to verify it fails**

Run: `tsx --test tests/opencode-install.test.ts`

Expected: FAIL because no lifecycle state file is written yet and the helper module does not exist.

**Step 3: Write the minimal lifecycle helper implementation**

Create `src/lib/install-state.ts` with only the helpers needed in this slice:

```ts
export type InstallState = {
  schemaVersion: 1
  platform: 'opencode'
  bonfireDir: string
  pluginPath: string
  templateFiles: string[]
}

export function readInstallState(bonfireDir: string): InstallState | null
export function writeInstallState(input: {
  bonfireDir: string
  pluginPath: string
  templateRoot: string
}): void
export function bonfireMatchesLegacyTemplate(input: {
  bonfireDir: string
  templateRoot: string
}): boolean
export function pluginLooksLikeManagedMyIslandPlugin(source: string): boolean
```

Implementation rules:
- Store the file at `path.join(bonfireDir, 'runtime', 'my-island-install.json')`.
- `templateFiles` must be a stable, sorted list of relative paths from `templates/bonfire/**`.
- `bonfireMatchesLegacyTemplate()` must return true only when the bonfire file set exactly matches the template file set and every tracked file has identical contents.
- `pluginLooksLikeManagedMyIslandPlugin()` must use a narrow signature check based on the current adapter shape, for example requiring all of these substrings:
  - `export const myIslandPlugin = async`
  - `'shell.env': async`
  - `'chat.message': async`
  - `[my-island context]`
- Do not build a generic installer framework; keep everything OpenCode-specific and small.

Modify `src/lib/fs.ts` only as needed to support the helper file, for example a deterministic recursive relative-file listing helper and a remove-if-exists helper you will reuse later.

Modify `src/lib/paths.ts` only as needed to expose:

```ts
export function resolveBonfireInstallStatePath(bonfireDir: string) {
  return path.join(bonfireDir, 'runtime', 'my-island-install.json')
}
```

Update `src/platforms/opencode.ts` so `installOpencode()` writes install state only after the bonfire copy and adapter copy succeed.

**Step 4: Run test to verify it passes**

Run: `tsx --test tests/opencode-install.test.ts`

Expected: PASS, including the new install-state assertions.

**Acceptance Criteria:**
- Fresh install writes `runtime/my-island-install.json`.
- The state file records `schemaVersion`, `platform`, `bonfireDir`, `pluginPath`, and sorted `templateFiles`.
- Legacy-template detection returns false as soon as a user-authored file appears.
- Existing install behavior still passes unchanged.

**Step 5: Commit**

```bash
git add src/lib/install-state.ts src/lib/fs.ts src/lib/paths.ts src/platforms/opencode.ts tests/opencode-install.test.ts
git commit -m "feat(opencode): persist install state"
```

## Task 2: Implement safe real uninstall for managed OpenCode installs

**Files:**
- Modify: `src/commands/uninstall.ts`
- Modify: `src/platforms/opencode.ts`
- Test: `tests/opencode-uninstall.test.ts`

**Step 1: Write the failing uninstall tests**

Create `tests/opencode-uninstall.test.ts` with temp-directory lifecycle cases. Reuse the same fixture style as `tests/opencode-install.test.ts`, and call `installOpencode()` in the test setup when you need a managed install.

Add these exact behavior tests:

```ts
test('uninstall removes bonfire, plugin, and install state for a managed install', async () => {
  const fixture = createFixture()

  try {
    await installOpencode({ cwd: repoRoot, env: { BONFIRE_DIR: fixture.bonfireDir }, homeDir: fixture.homeDir })

    const result = await uninstallOpencode({
      cwd: repoRoot,
      env: { BONFIRE_DIR: fixture.bonfireDir },
      homeDir: fixture.homeDir,
    })

    assert.equal(result.ok, true)
    assert.equal(fs.existsSync(fixture.bonfireDir), false)
    assert.equal(fs.existsSync(fixture.pluginPath), false)
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true })
  }
})

test('uninstall refuses to remove a legacy bonfire with extra user files', async () => {
  // create a template-only bonfire, add memory/user-note.md, deploy a valid plugin,
  // then assert uninstall returns ok: false and leaves both bonfire + plugin in place.
})

test('uninstall removes a legacy template-only bonfire when it still matches the shipped template exactly', async () => {
  // copy templates/bonfire directly, deploy the adapter file, then assert uninstall succeeds.
})
```

**Step 2: Run test to verify it fails**

Run: `tsx --test tests/opencode-uninstall.test.ts`

Expected: FAIL because `uninstallOpencode()` does not exist and the command is still a placeholder.

**Step 3: Write the minimal uninstall implementation**

Extend `src/platforms/opencode.ts` with:

```ts
export type UninstallResult =
  | { ok: true; bonfireDir: string; pluginPath: string; removedBonfire: boolean; removedPlugin: boolean }
  | { ok: false; message: string }

export async function uninstallOpencode(input: {
  cwd: string
  env: NodeJS.ProcessEnv
  homeDir?: string
}): Promise<UninstallResult>
```

Uninstall rules are fixed for this slice:
- Resolve `repoRoot`, `templateRoot`, `bonfireDir`, and `pluginPath` with the existing helpers.
- If neither bonfire nor plugin exists, return `{ ok: false, message: 'No OpenCode install found ...' }`.
- Treat bonfire as removable when either:
  - `runtime/my-island-install.json` exists and parses successfully, or
  - the bonfire exactly matches the legacy template file set.
- Treat the plugin as removable only when the plugin file exists and `pluginLooksLikeManagedMyIslandPlugin()` returns true.
- If bonfire exists but fails the managed-install checks, abort with `ok: false` and do not remove anything.
- If plugin exists but fails the managed-plugin check, abort with `ok: false` and do not remove anything.
- When removal is allowed, delete the plugin first, then delete the bonfire directory.
- Keep the implementation synchronous internally if that stays simpler; the public function can still be `async` for parity with install.

Update `src/commands/uninstall.ts` to call `uninstallOpencode()` and print:

```text
Uninstalled my-island for opencode.
Bonfire: <path or "not found">
Plugin: <path or "not found">
```

On failure, print the error message to stderr and return exit code `1`.

**Step 4: Run test to verify it passes**

Run: `tsx --test tests/opencode-uninstall.test.ts`

Expected: PASS.

**Acceptance Criteria:**
- Managed installs uninstall cleanly.
- Legacy template-only installs uninstall cleanly.
- Legacy bonfire instances with extra user files fail safely and preserve all files.
- Command-level failures return exit code `1` and do not partially delete the install.

**Step 5: Commit**

```bash
git add src/commands/uninstall.ts src/platforms/opencode.ts tests/opencode-uninstall.test.ts
git commit -m "feat(opencode): add safe uninstall"
```

## Task 3: Implement conservative upgrade for adapter refresh and lifecycle backfill

**Files:**
- Modify: `src/commands/upgrade.ts`
- Modify: `src/platforms/opencode.ts`
- Test: `tests/opencode-upgrade.test.ts`

**Step 1: Write the failing upgrade tests**

Create `tests/opencode-upgrade.test.ts` with cases that define the exact upgrade contract.

Add these tests:

```ts
test('upgrade backfills runtime/my-island-install.json for a legacy bonfire', async () => {
  // create a legacy bonfire by copying templates/bonfire without the state file,
  // deploy the adapter file, run upgradeOpencode(), then assert the state file exists.
})

test('upgrade recreates the OpenCode plugin when bonfire exists but the plugin is missing', async () => {
  // create a managed bonfire, delete the plugin, run upgrade, assert the plugin is restored.
})

test('upgrade restores missing template scaffolding without overwriting user-authored files', async () => {
  // remove runtime/.gitkeep, add memory/user-note.md, run upgrade,
  // assert runtime/.gitkeep returns and memory/user-note.md stays untouched.
})

test('upgrade fails when no bonfire install exists', async () => {
  // run upgrade against an empty fixture and assert ok: false with a clear message.
})
```

Add one safety case too:

```ts
test('upgrade refuses to overwrite a plugin that does not look like a managed my-island adapter', async () => {
  // write custom plugin content and assert upgrade fails without changing the file.
})
```

**Step 2: Run test to verify it fails**

Run: `tsx --test tests/opencode-upgrade.test.ts`

Expected: FAIL because `upgradeOpencode()` does not exist and the command is still a placeholder.

**Step 3: Write the minimal upgrade implementation**

Extend `src/platforms/opencode.ts` with:

```ts
export type UpgradeResult =
  | { ok: true; bonfireDir: string; pluginPath: string; changed: boolean }
  | { ok: false; message: string }

export async function upgradeOpencode(input: {
  cwd: string
  env: NodeJS.ProcessEnv
  homeDir?: string
}): Promise<UpgradeResult>
```

Upgrade rules are fixed for this slice:
- Require a recognizable bonfire instance at `bonfireDir`; if the directory does not exist, fail with `ok: false` and tell the user to run `install` first.
- Accept both managed installs and legacy template-compatible installs.
- Never delete user-authored bonfire content.
- Ensure every missing file from `templates/bonfire/**` is present after upgrade.
- Never overwrite a bonfire file that already exists, even if the template version differs.
- Recreate the plugin when missing.
- Replace the plugin when it already exists only if it passes `pluginLooksLikeManagedMyIslandPlugin()`.
- Fail without changing the plugin when the existing plugin does not look managed.
- Always write or refresh `runtime/my-island-install.json` after a successful upgrade.
- Set `changed: false` only when the state file, template scaffolding, and plugin were already current.

Update `src/commands/upgrade.ts` to print:

```text
Upgraded my-island for opencode.
Bonfire: <path>
Plugin: <path>
```

If `changed === false`, print one extra line:

```text
Already up to date.
```

**Step 4: Run test to verify it passes**

Run: `tsx --test tests/opencode-upgrade.test.ts`

Expected: PASS.

**Acceptance Criteria:**
- Upgrade backfills the lifecycle state file for legacy installs.
- Upgrade restores missing template scaffolding but never overwrites user files.
- Upgrade recreates or refreshes the adapter only for recognized managed installs.
- Unrecognized plugin content causes a clean failure with no mutation.

**Step 5: Commit**

```bash
git add src/commands/upgrade.ts src/platforms/opencode.ts tests/opencode-upgrade.test.ts
git commit -m "feat(opencode): add conservative upgrade"
```

## Task 4: Tighten top-level CLI coverage for lifecycle commands

**Files:**
- Modify: `tests/cli-surface.test.ts`
- Modify: `src/commands/install.ts`
- Modify: `src/commands/uninstall.ts`
- Modify: `src/commands/upgrade.ts`

**Step 1: Write the failing CLI lifecycle tests**

Replace the placeholder-only assertion in `tests/cli-surface.test.ts` with real command-surface checks.

Add or update cases so the file covers:

```ts
test('uninstall --platform opencode completes full cleanup through the CLI', () => {
  // create a managed install in the fixture, run the CLI uninstall command,
  // then assert exit code 0, success text, and missing bonfire/plugin paths.
})

test('uninstall exits non-zero when the bonfire contains user-authored files', () => {
  // create a legacy-looking bonfire plus memory/user-note.md, then assert status 1.
})

test('upgrade --platform opencode restores a missing plugin through the CLI', () => {
  // create bonfire, remove the plugin, run upgrade, assert status 0 and plugin restored.
})
```

Keep the existing `--platform` validation cases unchanged.

**Step 2: Run test to verify it fails**

Run: `tsx --test tests/cli-surface.test.ts`

Expected: FAIL until the command handlers print the final success/failure text expected by the new CLI tests.

**Step 3: Write the minimal command-surface updates**

Adjust `src/commands/install.ts`, `src/commands/uninstall.ts`, and `src/commands/upgrade.ts` only as needed so they:
- print consistent lifecycle summaries
- send errors to stderr
- return `0` for success and `1` for failure
- keep the public syntax identical to slice 1

Do not add extra subcommands, aliases, or interactive prompts.

**Step 4: Run test to verify it passes**

Run: `tsx --test tests/cli-surface.test.ts`

Expected: PASS.

**Acceptance Criteria:**
- CLI integration tests cover real install, uninstall, and upgrade behavior.
- Placeholder text is removed from the public uninstall/upgrade happy paths.
- Public command syntax is unchanged.

**Step 5: Commit**

```bash
git add src/commands/install.ts src/commands/uninstall.ts src/commands/upgrade.ts tests/cli-surface.test.ts
git commit -m "test(cli): cover lifecycle commands"
```

## Task 5: Rewrite README into a real new-device Quick Start and lock it with tests

**Files:**
- Modify: `README.md`
- Test: `tests/readme-quickstart.test.ts`

**Step 1: Write the failing README surface test**

Create `tests/readme-quickstart.test.ts` that reads `README.md` as text and asserts the Quick Start includes the exact lifecycle commands and the key operational constraints.

Add these assertions:

```ts
test('README includes an OpenCode Quick Start path', () => {
  const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8')

  assert.match(readme, /bunx github:teatin\/my-island install --platform opencode/)
  assert.match(readme, /bunx github:teatin\/my-island upgrade --platform opencode/)
  assert.match(readme, /bunx github:teatin\/my-island uninstall --platform opencode/)
  assert.match(readme, /BONFIRE_DIR/)
  assert.match(readme, /~\/\.local\/share\/bonfire/)
})
```

Add one docs-intent check too:

```ts
test('README keeps bonfire as an internal lifecycle facility, not a public top-level command', () => {
  const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8')
  assert.doesNotMatch(readme, /my-island bonfire /)
})
```

**Step 2: Run test to verify it fails**

Run: `tsx --test tests/readme-quickstart.test.ts`

Expected: FAIL because `README.md` does not yet front-load a concrete Quick Start.

**Step 3: Rewrite the README Quick Start section**

Update `README.md` near the top so a new-device user can copy-paste the lifecycle flow without reading the full system philosophy first.

Required README structure for this slice:
- Add a short Chinese `## Quick Start` section near the top.
- Include the exact install command.
- Include one short verification checklist that tells the reader what should exist after install:
  - bonfire at `BONFIRE_DIR` or `~/.local/share/bonfire`
  - adapter at `~/.config/opencode/plugins/my-island.ts`
- Include when to run `upgrade --platform opencode`.
- Include when to run `uninstall --platform opencode`, and explicitly note that uninstall is conservative and may refuse to remove bonfire content it cannot identify as my-island-managed.
- Keep the broader conceptual README content intact; do not translate the whole file to English and do not remove the design-boundary sections.

**Step 4: Run test to verify it passes**

Run: `tsx --test tests/readme-quickstart.test.ts`

Expected: PASS.

**Acceptance Criteria:**
- README contains a copy-pasteable Quick Start near the top.
- README documents install, verify, upgrade, and uninstall in the actual supported CLI syntax.
- README does not introduce `bonfire` as a public command.

**Step 5: Commit**

```bash
git add README.md tests/readme-quickstart.test.ts
git commit -m "docs(readme): add opencode quick start"
```

## Task 6: Run the full repo validation wave and capture release confidence

**Files:**
- Test only: no source-file targets beyond the files already changed in Tasks 1-5

**Step 1: Run the focused lifecycle suite**

Run:

```bash
tsx --test tests/opencode-install.test.ts tests/opencode-uninstall.test.ts tests/opencode-upgrade.test.ts tests/cli-surface.test.ts tests/readme-quickstart.test.ts
```

Expected: PASS.

**Step 2: Run full repository validation**

Run: `npm run validate`

Expected: PASS.

**Step 3: Do one manual temp-dir smoke check**

Run these exact commands from the repo root with a disposable fixture:

```bash
ROOT="$(mktemp -d)"
HOME="$ROOT/home" BONFIRE_DIR="$ROOT/bonfire" node --import tsx ./src/cli.ts install --platform opencode
HOME="$ROOT/home" BONFIRE_DIR="$ROOT/bonfire" node --import tsx ./src/cli.ts upgrade --platform opencode
HOME="$ROOT/home" BONFIRE_DIR="$ROOT/bonfire" node --import tsx ./src/cli.ts uninstall --platform opencode
rm -rf "$ROOT"
```

Expected:
- install succeeds and creates both bonfire + plugin
- upgrade succeeds and reports either upgrade or already-up-to-date
- uninstall succeeds for the clean managed fixture

**Step 4: Record execution notes for Atlas handoff**

Add a short implementation summary to the session handoff covering:
- which tests were added
- the lifecycle-state file path
- the conservative uninstall boundary
- the conservative upgrade boundary

There is no new commit here if Task 5 already passed and the tree is clean.

**Acceptance Criteria:**
- Focused lifecycle tests pass.
- `npm run validate` passes.
- Manual temp-dir smoke check passes.
- Atlas handoff notes call out the safe-boundary behavior clearly.
