# linkbox

A tiny self-hosted bookmarking service: save links with tags from the
command line, query them over a local HTTP API. No frameworks, no database —
plain Node + TypeScript (run via `tsx`), JSON file persistence.

Built as a driving project for [HITL](../HITL): three packages so the repo
level of the graph shows real services, and four independent milestones so
each one can live in its own HITL worktree with its own agent.

```
shared/   domain types (Link, LinkStore) — both sides import from here
api/      HTTP server (node:http), owns persistence
cli/      `lb` command-line client, talks to the api over fetch
```

## Milestones (one HITL worktree each)

1. **`feat/store`** — implement a `JsonFileStore` in `api/src/store.ts`
   satisfying `LinkStore` from `@linkbox/shared`: atomic writes to
   `~/.linkbox/links.json`, `node:test` coverage for add/list/remove
   (test files live next to sources as `*.test.ts`).
2. **`feat/api-crud`** — real routes in `api/src/server.ts`:
   `GET /links`, `POST /links` (fetches the page `<title>` if none given),
   `DELETE /links/:id`. Depends on milestone 1.
3. **`feat/cli`** — `lb add <url> [--tag x --tag y]`, `lb list`,
   `lb rm <id>` in `cli/src/main.ts`, with table output. Only needs the
   API contract, so it can run in parallel with milestone 2.
4. **`feat/search`** — `GET /links?tag=x&q=text` on the api plus
   `lb search <query>` on the cli. Touches both services — watch the
   universe view light both folders.

## Running

```sh
npm install
npm run api      # serve http://localhost:4321
npm run cli      # the lb client
npm test
```
