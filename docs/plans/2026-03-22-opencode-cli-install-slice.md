# OpenCode CLI Install Slice Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship the first public CLI slice so `bunx github:teatin/my-island install --platform opencode` performs a real OpenCode install, while `uninstall --platform opencode` and `upgrade --platform opencode` exist as stable command-entry placeholders.

**Architecture:** Add a minimal TypeScript CLI entrypoint with native argument parsing, keep `bonfire` internal to the install flow, and implement the `opencode` installer as a small filesystem pipeline: resolve paths, create a fresh bonfire instance from `templates/bonfire/`, then copy the repo-owned OpenCode adapter into the OpenCode plugin directory. Keep uninstall and upgrade intentionally thin in slice 1: they must parse cleanly and return a clear placeholder message without widening scope into real removal or update logic.

**Tech Stack:** TypeScript, Node built-ins (`node:test`, `node:assert/strict`, `node:fs`, `node:path`, `node:os`, `node:child_process`), `tsx --test`, existing package scripts in `package.json`.

---

## Scope Locks

- Public commands in this slice are exactly:
  - `bunx github:teatin/my-island install --platform opencode`
  - `bunx github:teatin/my-island uninstall --platform opencode`
  - `bunx github:teatin/my-island upgrade --platform opencode`
- `bonfire` stays internal to install flow; do not add a public `bonfire` top-level command.
- First real implementation target is only `install --platform opencode`.
- `install` must resolve bonfire target via `BONFIRE_DIR` or default `~/.local/share/bonfire`.
- `install` must not overwrite an existing bonfire instance.
- `install` must instantiate from `templates/bonfire/`.
- `install` must deploy `adapters/opencode/my-island.ts` into the OpenCode plugin location.
- Preserve room for later TUI work, but do not add any TUI scope in this slice.
- Do not widen scope to Claude Code, Cursor, or architecture redesign.

## Exact Files Expected In This Slice

**Create:**
- `bin/my-island.mjs`
- `src/cli.ts`
- `src/commands/install.ts`
- `src/commands/uninstall.ts`
- `src/commands/upgrade.ts`
- `src/platforms/opencode.ts`
- `src/lib/paths.ts`
- `src/lib/fs.ts`
- `tests/cli-surface.test.ts`
- `tests/opencode-install.test.ts`

**Modify:**
- `package.json`
- `tsconfig.json`
- `README.md`

## Rollout Order

1. Make the CLI surface real and testable locally.
2. Lock path resolution and filesystem safety with failing tests.
3. Implement bonfire template install without overwrite behavior.
4. Implement OpenCode adapter deployment.
5. Wire end-to-end `install --platform opencode`.
6. Add stable placeholders for `uninstall` and `upgrade`.
7. Update docs and run full validation.

## Ultrawork / Execution Notes

- Keep one executor on the CLI/public-surface track at a time because `package.json`, `tsconfig.json`, and `src/cli.ts` are shared files.
- Parallel work is safe only after CLI scaffolding lands:
  - one executor can work on `tests/opencode-install.test.ts`
  - another can draft `README.md` usage updates
- Prefer local pure-function tests first, then one end-to-end CLI test, then full repo validation.
- Use temporary directories and explicit env overrides in tests; never write to the real `~/.config/opencode` or real `~/.local/share/bonfire` during test runs.

## Task 1: Establish the public CLI entry surface

**Files:**
- Create: `bin/my-island.mjs`
- Create: `src/cli.ts`
- Modify: `package.json`
- Modify: `tsconfig.json`
- Test: `tests/cli-surface.test.ts`

**Step 1: Write the failing CLI surface test**

Add `tests/cli-surface.test.ts` with focused cases that call the CLI through Node and assert:

```ts
test('install command requires --platform', () => {
  const result = runCli(['install'])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /--platform/)
})

test('unsupported platform is rejected', () => {
  const result = runCli(['install', '--platform', 'claude'])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Unsupported platform/)
})

test('uninstall and upgrade command names are recognized', () => {
  const uninstall = runCli(['uninstall', '--platform', 'opencode'])
  const upgrade = runCli(['upgrade', '--platform', 'opencode'])
  assert.equal(uninstall.status, 0)
  assert.equal(upgrade.status, 0)
  assert.match(uninstall.stdout, /not implemented in slice 1/i)
  assert.match(upgrade.stdout, /not implemented in slice 1/i)
})
```

Use a local helper in the test that spawns:

```bash
node --import tsx ./src/cli.ts <args>
```

**Step 2: Run test to verify it fails**

Run: `tsx --test tests/cli-surface.test.ts`

Expected: FAIL because `src/cli.ts` and the bin entry do not exist yet.

**Step 3: Write the minimal CLI implementation**

Implement `src/cli.ts` with:
- a small exported `run(argv, io = process)` function
- native parsing for `install|uninstall|upgrade`
- required `--platform <value>` handling
- `opencode` as the only accepted platform in slice 1
- dispatch to command modules
- non-zero exit for invalid syntax or unsupported platform

Implement `bin/my-island.mjs` as the thin executable wrapper:

```js
#!/usr/bin/env node
import { run } from '../src/cli.ts'

const exitCode = await run(process.argv.slice(2))
process.exitCode = exitCode
```

Modify `package.json`:
- add `"bin": { "my-island": "./bin/my-island.mjs" }`

Modify `tsconfig.json`:
- extend `include` to cover `src/**/*.ts` and `bin/**/*.mjs` only if needed for type-adjacent tooling

Add stub command modules now so the CLI compiles:
- `src/commands/install.ts`
- `src/commands/uninstall.ts`
- `src/commands/upgrade.ts`

Each command should export a small async handler returning an exit code.

**Step 4: Run test to verify it passes**

Run: `tsx --test tests/cli-surface.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add bin/my-island.mjs src/cli.ts src/commands/install.ts src/commands/uninstall.ts src/commands/upgrade.ts package.json tsconfig.json tests/cli-surface.test.ts
git commit -m "feat(cli): add public command surface"
```

## Task 2: Lock opencode install path resolution and safety rules

**Files:**
- Create: `src/lib/paths.ts`
- Test: `tests/opencode-install.test.ts`

**Step 1: Write the failing path-resolution test**

Add focused tests for the internal path helpers:

```ts
test('resolveBonfireDir prefers BONFIRE_DIR', () => {
  const actual = resolveBonfireDir({
    env: { BONFIRE_DIR: '/tmp/custom-bonfire' },
    homeDir: '/Users/tester',
  })

  assert.equal(actual, path.resolve('/tmp/custom-bonfire'))
})

test('resolveBonfireDir falls back to ~/.local/share/bonfire', () => {
  const actual = resolveBonfireDir({ env: {}, homeDir: '/Users/tester' })
  assert.equal(actual, '/Users/tester/.local/share/bonfire')
})

test('resolveOpenCodePluginPath targets the plugins directory', () => {
  const actual = resolveOpenCodePluginPath({ env: {}, homeDir: '/Users/tester' })
  assert.equal(actual, '/Users/tester/.config/opencode/plugins/my-island.ts')
})
```

Add install guard tests:

```ts
test('install aborts when bonfire target already exists', async () => {
  const result = await installOpencode({ ...fixtureWithExistingBonfire })
  assert.equal(result.ok, false)
  assert.match(result.message, /already exists/i)
})
```

**Step 2: Run test to verify it fails**

Run: `tsx --test tests/opencode-install.test.ts`

Expected: FAIL because the helpers and installer contract do not exist yet.

**Step 3: Write the minimal path helpers**

Implement `src/lib/paths.ts` with only the slice-1 path rules:
- `resolveBonfireDir({ env, homeDir })`
- `resolveOpenCodePluginPath({ env, homeDir })`
- `resolveRepoRoot(fromDir)` that searches upward for `SPEC.md` and `docs/adapter-model.md`
- `resolveAdapterSourcePath(repoRoot)` returning `adapters/opencode/my-island.ts`
- `resolveTemplateRoot(repoRoot)` returning `templates/bonfire`

Important rules:
- keep fallback behavior consistent with `adapters/opencode/my-island.ts`
- keep path logic strict and deterministic
- do not add platform-general abstractions beyond what this slice needs

**Step 4: Run test to verify it passes**

Run: `tsx --test tests/opencode-install.test.ts`

Expected: path-resolution cases PASS while copy/deploy cases still fail or remain skipped/TODO-marked in the test file until the next task.

**Step 5: Commit**

```bash
git add src/lib/paths.ts tests/opencode-install.test.ts
git commit -m "test(opencode): lock install path rules"
```

## Task 3: Implement fresh bonfire instantiation from the repo template

**Files:**
- Create: `src/lib/fs.ts`
- Create: `src/platforms/opencode.ts`
- Test: `tests/opencode-install.test.ts`

**Step 1: Write the failing bonfire copy tests**

Extend `tests/opencode-install.test.ts` with temp-directory integration cases:

```ts
test('install copies templates/bonfire into a fresh BONFIRE_DIR', async () => {
  const result = await installOpencode({ ...fixture })

  assert.equal(result.ok, true)
  assert.equal(fs.existsSync(path.join(fixture.bonfireDir, 'memory', '.gitkeep')), true)
  assert.equal(fs.existsSync(path.join(fixture.bonfireDir, 'missions', '.gitkeep')), true)
})

test('install never overwrites an existing bonfire instance', async () => {
  fs.mkdirSync(fixture.bonfireDir, { recursive: true })
  fs.writeFileSync(path.join(fixture.bonfireDir, 'memory', 'keep.txt'), 'do not touch')

  const result = await installOpencode({ ...fixture })

  assert.equal(result.ok, false)
  assert.match(result.message, /bonfire already exists/i)
  assert.equal(fs.readFileSync(path.join(fixture.bonfireDir, 'memory', 'keep.txt'), 'utf8'), 'do not touch')
})
```

**Step 2: Run test to verify it fails**

Run: `tsx --test tests/opencode-install.test.ts`

Expected: FAIL because template copy behavior is not implemented.

**Step 3: Write the minimal bonfire copy implementation**

Implement in `src/lib/fs.ts`:
- `copyDirectoryRecursive(sourceDir, targetDir)`
- `ensureParentDir(filePath)`

Implement in `src/platforms/opencode.ts`:
- `installOpencode(options)` with a first successful stage that:
  - resolves repo root
  - resolves template root
  - resolves bonfire dir
  - aborts if bonfire dir already exists
  - copies `templates/bonfire/` into the target dir

Return a small structured result for testing:

```ts
type InstallResult =
  | { ok: true; bonfireDir: string; pluginPath: string }
  | { ok: false; message: string }
```

**Step 4: Run test to verify it passes**

Run: `tsx --test tests/opencode-install.test.ts`

Expected: bonfire-instantiation cases PASS.

**Step 5: Commit**

```bash
git add src/lib/fs.ts src/platforms/opencode.ts tests/opencode-install.test.ts
git commit -m "feat(opencode): install fresh bonfire template"
```

## Task 4: Deploy the repo-owned OpenCode adapter into the plugin location

**Files:**
- Modify: `src/platforms/opencode.ts`
- Test: `tests/opencode-install.test.ts`

**Step 1: Write the failing adapter deployment tests**

Extend `tests/opencode-install.test.ts` with assertions around plugin deployment:

```ts
test('install copies adapters/opencode/my-island.ts into the OpenCode plugin directory', async () => {
  const result = await installOpencode({ ...fixture })

  assert.equal(result.ok, true)
  assert.equal(fs.existsSync(fixture.pluginPath), true)

  const source = fs.readFileSync(fixture.adapterSourcePath, 'utf8')
  const deployed = fs.readFileSync(fixture.pluginPath, 'utf8')
  assert.equal(deployed, source)
})

test('install creates the OpenCode plugins parent directory when missing', async () => {
  const result = await installOpencode({ ...fixture })
  assert.equal(result.ok, true)
  assert.equal(fs.existsSync(path.dirname(fixture.pluginPath)), true)
})
```

If you want one extra safety test, add:

```ts
test('install leaves bonfire intact if adapter source is missing', async () => {
  // expect a clean failure before partial deployment is reported successful
})
```

**Step 2: Run test to verify it fails**

Run: `tsx --test tests/opencode-install.test.ts`

Expected: FAIL because adapter deployment is not implemented.

**Step 3: Write the minimal adapter deployment implementation**

Update `installOpencode(options)` so it also:
- resolves `adapters/opencode/my-island.ts` from the repo root
- resolves OpenCode plugin target `~/.config/opencode/plugins/my-island.ts`
- creates the parent directory if needed
- copies the adapter file byte-for-byte

Do not add compilation, bundling, or plugin registry logic in this slice.

**Step 4: Run test to verify it passes**

Run: `tsx --test tests/opencode-install.test.ts`

Expected: adapter deployment cases PASS.

**Step 5: Commit**

```bash
git add src/platforms/opencode.ts tests/opencode-install.test.ts
git commit -m "feat(opencode): deploy adapter plugin on install"
```

## Task 5: Wire the real `install --platform opencode` command end to end

**Files:**
- Modify: `src/commands/install.ts`
- Modify: `src/cli.ts`
- Test: `tests/cli-surface.test.ts`

**Step 1: Write the failing end-to-end install CLI test**

Add a CLI integration case using temp directories and env overrides:

```ts
test('install --platform opencode completes the full filesystem flow', () => {
  const result = runCli(
    ['install', '--platform', 'opencode'],
    {
      env: {
        ...process.env,
        HOME: fixture.homeDir,
        BONFIRE_DIR: fixture.bonfireDir,
      },
    },
  )

  assert.equal(result.status, 0)
  assert.match(result.stdout, /installed/i)
  assert.equal(fs.existsSync(path.join(fixture.bonfireDir, 'docs', '.gitkeep')), true)
  assert.equal(fs.existsSync(fixture.pluginPath), true)
})
```

Also add a failure-path CLI test:

```ts
test('install exits non-zero when bonfire already exists', () => {
  const result = runCli(['install', '--platform', 'opencode'], fixtureEnvWithExistingBonfire)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /already exists/i)
})
```

**Step 2: Run test to verify it fails**

Run: `tsx --test tests/cli-surface.test.ts`

Expected: FAIL because `install` command is still a stub.

**Step 3: Write the minimal install command implementation**

Implement `src/commands/install.ts` so it:
- accepts only `platform: 'opencode'`
- calls `installOpencode(...)`
- prints a short success summary on stdout:
  - installed bonfire path
  - deployed plugin path
- prints clear failures on stderr
- returns exit code `0` or `1`

Keep output intentionally plain; do not add TUI, spinners, prompts, or interactive confirmation in slice 1.

**Step 4: Run test to verify it passes**

Run: `tsx --test tests/cli-surface.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/commands/install.ts src/cli.ts tests/cli-surface.test.ts
git commit -m "feat(cli): wire opencode install command"
```

## Task 6: Add stable placeholders for `uninstall` and `upgrade`

**Files:**
- Modify: `src/commands/uninstall.ts`
- Modify: `src/commands/upgrade.ts`
- Test: `tests/cli-surface.test.ts`

**Step 1: Write the failing placeholder behavior tests**

If not already covered in Task 1, add explicit assertions:

```ts
test('uninstall --platform opencode is a stable placeholder', () => {
  const result = runCli(['uninstall', '--platform', 'opencode'])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /planned next task/i)
})

test('upgrade --platform opencode is a stable placeholder', () => {
  const result = runCli(['upgrade', '--platform', 'opencode'])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /planned next task/i)
})
```

**Step 2: Run test to verify it fails**

Run: `tsx --test tests/cli-surface.test.ts`

Expected: FAIL if the current placeholder text is not stable or explicit enough.

**Step 3: Write the minimal placeholder implementation**

Implement both commands so they:
- parse successfully for `--platform opencode`
- print a stable, explicit message such as:
  - `uninstall --platform opencode is planned next; slice 1 only installs bonfire and deploys the adapter.`
  - `upgrade --platform opencode is planned next; slice 1 only installs bonfire and deploys the adapter.`
- return exit code `0`

Do not delete plugin files, remove bonfire, or add upgrade logic yet.

**Step 4: Run test to verify it passes**

Run: `tsx --test tests/cli-surface.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/commands/uninstall.ts src/commands/upgrade.ts tests/cli-surface.test.ts
git commit -m "feat(cli): add uninstall and upgrade placeholders"
```

## Task 7: Document the public CLI slice and run full validation

**Files:**
- Modify: `README.md`

**Step 1: Write the failing documentation checklist**

Before editing docs, define the exact statements that must appear in `README.md`:
- the three public commands
- `install --platform opencode` is real in slice 1
- `uninstall` and `upgrade` are placeholders for the next slice
- bonfire default path is `~/.local/share/bonfire`
- `BONFIRE_DIR` can override the bonfire target
- install will not overwrite an existing bonfire instance

Treat missing items as the failing state.

**Step 2: Run validation before doc update**

Run:

```bash
npm run typecheck
npm test
```

Expected: PASS for code, but docs checklist still incomplete.

**Step 3: Write the minimal README update**

Add a small English-facing CLI section to `README.md` that documents:
- public command surface
- current slice boundary
- install behavior and safety rule
- future placeholder status for uninstall/upgrade

Keep the existing project framing intact. Do not rewrite the whole README.

**Step 4: Run final validation**

Run:

```bash
npm run validate
```

Expected: PASS.

Then smoke-test locally:

```bash
node --import tsx ./src/cli.ts install --platform opencode
node --import tsx ./src/cli.ts uninstall --platform opencode
node --import tsx ./src/cli.ts upgrade --platform opencode
```

Expected:
- install succeeds in a temp-controlled environment
- uninstall prints placeholder message
- upgrade prints placeholder message

**Step 5: Commit**

```bash
git add README.md
git commit -m "docs: document opencode cli slice"
```

## Acceptance Criteria

- `package.json` exposes a real CLI bin for `my-island`.
- `src/cli.ts` recognizes `install`, `uninstall`, and `upgrade`.
- `install --platform opencode` succeeds when the bonfire target does not exist.
- `install --platform opencode` resolves bonfire via `BONFIRE_DIR` or `~/.local/share/bonfire`.
- `install --platform opencode` copies `templates/bonfire/` into a fresh bonfire target.
- `install --platform opencode` never overwrites an existing bonfire instance.
- `install --platform opencode` copies `adapters/opencode/my-island.ts` into the OpenCode plugin location.
- `uninstall --platform opencode` and `upgrade --platform opencode` are stable recognized commands with explicit placeholder output.
- Tests cover CLI parsing, path resolution, fresh install flow, existing-instance refusal, and adapter deployment.
- `npm run validate` passes.

## Exact Test Commands

Run these in order while implementing:

```bash
tsx --test tests/cli-surface.test.ts
tsx --test tests/opencode-install.test.ts
npm run typecheck
npm test
npm run validate
```

## Atomic Commit Strategy

Use small commits that match the TDD slices above:

1. `feat(cli): add public command surface`
2. `test(opencode): lock install path rules`
3. `feat(opencode): install fresh bonfire template`
4. `feat(opencode): deploy adapter plugin on install`
5. `feat(cli): wire opencode install command`
6. `feat(cli): add uninstall and upgrade placeholders`
7. `docs: document opencode cli slice`

If a task grows beyond one concern, split it before coding; do not combine parser, filesystem copy, and docs in the same commit.

## Follow-up Tasks For Slice 2

- Implement real `uninstall --platform opencode` behavior with safe removal rules.
- Implement real `upgrade --platform opencode` behavior for repo-owned adapter refresh without destroying user state.
- Add a dedicated smoke-test strategy for `bunx github:teatin/my-island ...` once the local CLI path is stable.
