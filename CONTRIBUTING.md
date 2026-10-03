# Contributing to effect-oxlint

Thanks for your interest in contributing. This guide covers everything you need to get started.

## Prerequisites

- [Bun](https://bun.sh) 1.4.0
- Node.js 24.11 or newer in the 24.x line (used by Vite+ and Vitest 5)

## Setup

```sh
git clone https://github.com/mpsuesser/effect-oxlint.git
cd effect-oxlint
bun install
```

## Development Workflow

```sh
bun run check       # lint + format + typecheck (auto-fix)
bun run test        # run all tests
bun run typecheck   # patched TypeScript type-check only
```

Run a single test file or by name:

```sh
bunx vitest run test/Rule.test.ts
bunx vitest run -t "reports for matching"
```

## Submitting a Pull Request

Release maintainers bump `package.json` and `jsr.json` together and update the
changelog. Main pushes verify and publish new npm versions with provenance;
already-published versions are skipped. A matching GitHub release tag (for
example `v0.4.0`) also publishes to JSR after npm verification. Publishing runs
are serialized to avoid duplicate uploads.

1. Fork the repo and create a branch from `main`.
2. Add or update tests for any changed behavior.
3. Make sure all three checks pass:
    ```sh
    bun run check && bun run test && bun run typecheck
    ```
4. Open a pull request with a clear description of the change.

## Code Style

See [AGENTS.md](./AGENTS.md) for detailed formatting, import ordering, naming conventions, and Effect patterns used in this project. The key points:

- Tabs, single quotes, semicolons, no trailing commas
- `Option` for absence, not `null`/`undefined`
- Effect modules (`Arr`, `R`, `P`) over native JS equivalents
- Dual API for public combinators
- JSDoc with `@since` on every export
- `readonly` on all fields and parameters

## Editor Setup

The `.vscode/` directory is gitignored. If you use VS Code, create `.vscode/settings.json` with:

```json
{
	"typescript.tsdk": "node_modules/typescript/lib",
	"typescript.enablePromptUseWorkspaceTsdk": true,
	"typescript.experimental.useTsgo": true
}
```

This enables the workspace TypeScript SDK and native type-checking.

## Reporting Issues

Use the [GitHub issue templates](https://github.com/mpsuesser/effect-oxlint/issues/new/choose) for bug reports and feature requests.
