# Mission Rules

## Mission Usability in OpenCode

A mission is considered usable in OpenCode when the first injected context can tell the agent:

- which active mission applies to the current worktree
- which member identity applies
- where that member's `plan.md`, `report.md`, and `notes.md` live
- where the inherited memory file lives
- where the mission rules document lives

If no safe mission match can be resolved, the adapter falls back to discussion-first mode.

## Human-Driven Maintenance Model

Mission files are not continuously rewritten by the adapter. Humans remain the source of truth after mission creation. The adapter may only inject hints and paths, not become a workflow engine.

## Single-File Memory

The single inherited memory file is `memory/inheritance.md`. It is the only file treated as the default inherited memory for future missions.

## What to Record

Record only:

- reusable workflow defaults
- stable implementation boundaries
- repeated pitfalls worth avoiding
- canonical patterns that should carry across missions
- constraints that are likely to remain true beyond one mission

## What Not to Record

Do not record:

- temporary progress
- active blockers
- one-off debugging notes
- draft ideas
- mission-local status
- unreviewed hunches

## When to Promote to Memory

A memory item is appended only when:

1. the insight was validated during execution or review
2. a member proposes it in `team/<member>/report.md`
3. the coordinator consolidates it into a candidate
4. the human confirms promotion
5. the approved entry is appended to `memory/inheritance.md`

## Alex and Lucase Sync Rules

- Alex and Lucase each own one executable slice at a time
- Each member updates only their own `team/<member>/report.md` during execution
- Required sync points are: slice started, blocked, ready for review, slice completed
- Only one member owns a shared file in a given wave

## Lianwu Decomposition Rules

Lianwu decomposes an approved implementation plan into member work by file ownership and dependency, not by arbitrary task count. Preferred seams:

- adapter and adapter tests
- bonfire template and bonfire docs
- install/upgrade propagation tests
- validation and integration

Do not split a strongly coupled file set across members just to increase concurrency.

## Script Boundary for Fixed Flows

Fixed, repeated flows may use a small bonfire script only if needed to reduce formatting drift. Do not add a general-purpose mission manager.
