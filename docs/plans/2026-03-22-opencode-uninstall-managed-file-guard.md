# OpenCode Uninstall Managed-File Guard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the uninstall safety bug so `uninstall --platform opencode` refuses removal whenever any managed bonfire template file has been modified.

**Architecture:** Keep the current ownership model centered on `runtime/my-island-install.json`, but change `bonfireMatchesInstallState()` to validate managed file contents against the repo-owned `templates/bonfire/` tree instead of the live installed bonfire path recorded in install state. Add one end-to-end uninstall regression test that proves a user-edited managed file blocks removal, then verify with the existing repo-level validation flow and the requested manual CLI scenario.

**Tech Stack:** TypeScript, Node built-ins (`node:test`, `node:assert/strict`, `node:fs`, `node:path`), existing installer helpers in `src/lib/install-state.ts`, `tsx --test`, `npm run validate`.

---

## Scope Locks

- Fix only the uninstall content-baseline bug described in `bonfireMatchesInstallState()`.
- Keep the trusted content source as the repo template tree at `templates/bonfire/`.
- Do not redesign install-state format in this slice; `templateFiles` remains a relative path list only.
- Do not add hashing, migration logic, force flags, or broader uninstall heuristics.
- Keep behavior conservative: modified managed files must block uninstall.
- Keep the commit message in Chinese exactly as requested.

## Known Context For Executor

- `src/lib/install-state.ts` already has the install-state helper boundary and currently reads expected content from `installState.bonfireDir`, which is the wrong baseline for content validation.
- `src/lib/paths.ts` already exposes `resolveTemplateRoot(repoRoot)` and that is the canonical way to locate `templates/bonfire/`.
- `src/platforms/opencode.ts` already calls `bonfireMatchesInstallState()` during uninstall safety checks.
- `tests/opencode-uninstall.test.ts` already covers managed uninstall success and legacy safety, but does not yet cover a modified managed file under install-state mode.
- `templateFiles` tracks only repo template files; `runtime/my-island-install.json` is runtime metadata and must not be treated as a template file for content comparison.

## Ultrawork / Execution Notes

- Keep one executor on this slice; both the helper change and the regression test touch the same uninstall safety seam.
- Follow strict TDD: write the failing uninstall regression first, run only the targeted test, then implement the smallest helper/platform change to make it pass.
- Prefer a narrow implementation: thread `templateRoot` into the validation path instead of inventing a new abstraction layer.
- After the targeted test passes, run the full suite and the explicit manual CLI repro from the bug report.
- Do not touch unrelated install or upgrade behavior unless the test exposes a real dependency.

## Atomic Commit Strategy

1. Keep all code and test changes in one atomic bug-fix commit because the regression test and helper fix describe a single behavior change.
2. Use this exact commit message:
   - `fix(opencode): 修正卸载时内容比对基准，检测托管文件是否被修改`
3. Do not create intermediate WIP commits unless execution tooling requires local checkpoints.

## Task 1: Lock the failing uninstall regression

**Files:**
- Modify: `tests/opencode-uninstall.test.ts`
- Reference: `tests/opencode-install.test.ts`

**Step 1: Write the failing test**

Add this regression case to `tests/opencode-uninstall.test.ts`:

```ts
test('uninstall refuses to remove when a managed file has been modified', async () => {
  const fixture = createFixture()

  try {
    await installOpencode({
      cwd: repoRoot,
      env: { BONFIRE_DIR: fixture.bonfireDir },
      homeDir: fixture.homeDir,
    })

    fs.writeFileSync(
      path.join(fixture.bonfireDir, 'README.md'),
      '用户修改后的内容'
    )

    const uninstallResult = await uninstallOpencode({
      cwd: repoRoot,
      env: { BONFIRE_DIR: fixture.bonfireDir },
      homeDir: fixture.homeDir,
    })

    assert.equal(uninstallResult.ok, false)
    assert.match(uninstallResult.message, /modified/i)
    assert.equal(fs.existsSync(fixture.bonfireDir), true)
    assert.equal(fs.existsSync(fixture.pluginPath), true)
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true })
  }
})
```

Place it near the other uninstall safety cases so the file reads as a behavior ladder: managed success -> managed modified refusal -> legacy refusal/success.

**Step 2: Run the targeted test to verify it fails**

Run: `tsx --test tests/opencode-uninstall.test.ts`

Expected: FAIL because uninstall still treats the edited managed file as safe to remove.

**Step 3: Sanity-check the failure shape**

Confirm the failing assertion proves the bug directly:
- uninstall currently returns `ok === true`, or
- the bonfire/plugin paths are deleted when they should remain.

Do not implement anything until the failing test reproduces the reported bug.

## Task 2: Fix the content baseline for install-state validation

**Files:**
- Modify: `src/lib/install-state.ts`
- Modify: `src/platforms/opencode.ts`
- Reference: `src/lib/paths.ts`

**Step 1: Implement the minimal helper contract change**

Update `bonfireMatchesInstallState()` so content validation uses the trusted template root, not `installState.bonfireDir`.

Target shape:

```ts
export function bonfireMatchesInstallState(input: {
  bonfireDir: string
  installState: InstallState
  templateRoot: string
}): boolean
```

Implementation rules:
- Keep the existing current-file enumeration from `input.bonfireDir`.
- Keep the expected file list from `input.installState.templateFiles`.
- For each `expectedFile`, read expected content from `path.join(input.templateRoot, expectedFile)`.
- Only compare content when that template file exists under `templates/bonfire/`.
- Do not attempt to compare `runtime/my-island-install.json`; it is not part of `templateFiles`.
- Preserve the strict file-count check so extra user files still fail validation.

**Step 2: Thread template root through uninstall**

Update the uninstall path in `src/platforms/opencode.ts` so the install-state validation call passes the repo template root resolved via `resolveTemplateRoot(repoRoot)`.

Keep the call flow small and local:

```ts
const templateRoot = resolveTemplateRoot(repoRoot)
bonfireMatchesInstallState({
  bonfireDir,
  installState,
  templateRoot,
})
```

Do not widen the change beyond the uninstall validation path unless TypeScript requires a small helper signature update.

**Step 3: Run the targeted test to verify it passes**

Run: `tsx --test tests/opencode-uninstall.test.ts`

Expected: PASS, including the new modified-managed-file case.

**Step 4: Review nearby safety behavior**

Quickly re-check that the helper still preserves these invariants:
- extra files still block removal
- missing tracked files still block removal
- exact managed installs still uninstall cleanly

If any nearby behavior breaks, fix only the minimal logic needed to restore the existing contract.

## Task 3: Run full verification and manual bug repro

**Files:**
- No new files
- Validate touched files: `src/lib/install-state.ts`, `src/platforms/opencode.ts`, `tests/opencode-uninstall.test.ts`

**Step 1: Run repo validation**

Run: `npm run validate`

Expected: PASS.

**Step 2: Run the full test suite count check**

Run: `tsx --test tests/*.test.ts`

Expected: all tests green, with the suite count matching the current expected total after the new regression test lands.

If the repo’s canonical validation command already prints the full passing count, record that output and do not invent a second counting mechanism.

**Step 3: Execute the manual CLI regression scenario**

Run exactly:

```bash
ROOT="$(mktemp -d)"
HOME="$ROOT/home" BONFIRE_DIR="$ROOT/bonfire" node --import tsx ./src/cli.ts install --platform opencode
echo "modified" >> "$ROOT/bonfire/README.md"
HOME="$ROOT/home" BONFIRE_DIR="$ROOT/bonfire" node --import tsx ./src/cli.ts uninstall --platform opencode
echo $?
ls "$ROOT/bonfire/README.md"
rm -rf "$ROOT"
```

Expected manual results:
- uninstall prints a refusal message mentioning modified or unsafe managed files
- exit code is `1`
- `$ROOT/bonfire/README.md` still exists after the uninstall attempt

**Step 4: Commit the slice**

Run:

```bash
git add src/lib/install-state.ts src/platforms/opencode.ts tests/opencode-uninstall.test.ts
git commit -m "fix(opencode): 修正卸载时内容比对基准，检测托管文件是否被修改"
```

Only commit after the targeted test, full validation, and manual repro all pass.

## Definition of Done

- `bonfireMatchesInstallState()` no longer reads expected managed content from `installState.bonfireDir`.
- Uninstall validates managed file contents against `templates/bonfire/`.
- `tests/opencode-uninstall.test.ts` contains the modified-managed-file regression and it passes.
- `npm run validate` passes.
- The manual CLI repro refuses uninstall with exit code `1` and leaves the bonfire files intact.
- The final commit uses `fix(opencode): 修正卸载时内容比对基准，检测托管文件是否被修改`.
