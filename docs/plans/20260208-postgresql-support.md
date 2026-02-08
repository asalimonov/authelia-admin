# Implementation Plan: PostgreSQL Support for Authelia Admin

**Date**: 2026-02-08
**Proposal**: `docs/proposals/20260208-postgresql-support.md`
**Target**: `docs/brainstorms/20260208-postgresql-support-target.md`

## Task List

### Task 1: Add `pg` dependency

**Files**: `package.json`

- [x] Run `npm install pg` to add node-postgres as a production dependency
- [x] Run `npm install -D @types/pg` to add TypeScript type definitions as a dev dependency
- [x] Verify with `npm ls pg` that the package is installed correctly

---

### Task 2: Restructure `DatabaseConfig` type and fix `getDatabaseConfig()`

**Files**: `src/lib/server/database.ts`

- [x] Replace the `connectionString?: string` field in `DatabaseConfig` interface (line 53) with a `postgres?` object containing `host: string`, `port: number`, `database: string`, `username: string`, `password: string`, `schema?: string`
- [x] In `getDatabaseConfig()` (line 314-320), replace the incomplete PostgreSQL parsing that only extracts `config.storage.postgres.host` as `connectionString`
- [x] Parse Authelia's `address: 'tcp://host:port'` format by replacing `tcp://` with `http://` and using `new URL()` to extract hostname and port
- [x] Add fallback to legacy `host` field for older Authelia configs (`if (pg.host && !pg.address)`)
- [x] Default port to `5432`, database to `'authelia'`, username to `'authelia'`, password to `''`, schema to `'public'`
- [x] Update the `log.debug()` call to show `host:port/database` instead of just "Using PostgreSQL database"

---

### Task 3: Implement `PostgreSQLAdapter` class

**Files**: `src/lib/server/database.ts`

- [x] Add `import pg from 'pg';` at the top of the file alongside existing imports
- [x] Create `class PostgreSQLAdapter implements DatabaseAdapter` after the `SQLiteAdapter` class
- [x] Add private `pool: pg.Pool` field and private constructor accepting a `pg.Pool`
- [x] Implement static `create(config)` factory method that creates a `pg.Pool` with host, port, database, user, password from config
- [x] In `create()`, add `pool.on('connect', ...)` handler to `SET search_path` if schema is not `'public'`
- [x] In `create()`, verify the connection by calling `pool.connect()` then `client.release()`
- [x] Implement `getTOTPConfigurations()` — same SELECT query, use `pool.query()`, return `result.rows` cast to `TOTPConfiguration[]`, mask secret with `Buffer.from('[ENCRYPTED]')`
- [x] Implement `deleteTOTPConfiguration(id)` — `DELETE FROM totp_configurations WHERE id = $1`, check `result.rowCount > 0`
- [x] Implement `getTOTPHistory(limit)` — same SELECT with `ORDER BY created_at DESC LIMIT $1`, use `pool.query()`, return `result.rows`
- [x] Implement `getBannedUsers()` — same SELECT query, use `pool.query()`, return `result.rows`
- [x] Implement `createBannedUser(username, expires, source, reason)` — `INSERT INTO banned_user ... VALUES ($1, $2, $3, $4)`, pass `Date` objects directly (PG handles natively, no `.toISOString().replace(...)` needed)
- [x] Implement `deleteBannedUser(id)` — `DELETE FROM banned_user WHERE id = $1`, check `result.rowCount > 0`
- [x] Implement `getBannedIPs()` — same SELECT query, use `pool.query()`, return `result.rows`
- [x] Implement `createBannedIP(ip, expires, source, reason)` — `INSERT INTO banned_ip ... VALUES ($1, $2, $3, $4)`, pass `Date` objects directly
- [x] Implement `deleteBannedIP(id)` — `DELETE FROM banned_ip WHERE id = $1`, check `result.rowCount > 0`
- [x] Implement `healthCheck()` — `pool.query('SELECT 1')`
- [x] Implement `close()` — `pool.end()`

---

### Task 4: Update `createDatabaseAdapter()` factory

**Files**: `src/lib/server/database.ts` (lines 329-347)

- [x] Replace `if (!config.connectionString)` check with `if (!config.postgres)` in the `'postgres'` case
- [x] Replace `return new PostgreSQLAdapter(config.connectionString)` with `return await PostgreSQLAdapter.create(config.postgres)`
- [x] Update the error message from "PostgreSQL connection string is required" to "PostgreSQL configuration is required"

---

### Task 5: Remove sqlite-only guards from page servers

**Files**: 4 page server files, 10 guard locations total

- [x] In `src/routes/(app)/totp/configurations/+page.server.ts` load function (lines 18-24): remove the `if (dbConfig.type !== 'sqlite')` block that returns `db_type_not_supported` error
- [x] In `src/routes/(app)/totp/configurations/+page.server.ts` delete action (lines 72-74): remove the `if (dbConfig.type !== 'sqlite')` block that returns `db_type_not_supported_short` via `fail(501)`
- [x] In `src/routes/(app)/totp/history/+page.server.ts` load function (lines 20-26): remove the `if (dbConfig.type !== 'sqlite')` block
- [x] In `src/routes/(app)/banned/users/+page.server.ts` load function (lines 19-25): remove the `if (dbConfig.type !== 'sqlite')` block
- [x] In `src/routes/(app)/banned/users/+page.server.ts` create action (lines 75-77): remove the `if (dbConfig.type !== 'sqlite')` block
- [x] In `src/routes/(app)/banned/users/+page.server.ts` delete action (lines 124-126): remove the `if (dbConfig.type !== 'sqlite')` block
- [x] In `src/routes/(app)/banned/ip/+page.server.ts` load function (lines 19-25): remove the `if (dbConfig.type !== 'sqlite')` block
- [x] In `src/routes/(app)/banned/ip/+page.server.ts` create action (lines 79-81): remove the `if (dbConfig.type !== 'sqlite')` block
- [x] In `src/routes/(app)/banned/ip/+page.server.ts` delete action (lines 128-130): remove the `if (dbConfig.type !== 'sqlite')` block

---

### Task 6: Replace `dbPath` with `dbInfo` in page servers

**Files**: same 4 page server files

- [x] In `src/routes/(app)/totp/configurations/+page.server.ts` load function: compute `dbInfo` string — for sqlite use `dbConfig.path`, for postgres use `"PostgreSQL: host:port/database"`, for other use `null`
- [x] In the same load function: replace `dbPath: dbConfig.path` with `dbInfo` in the return object
- [x] In `src/routes/(app)/totp/history/+page.server.ts` load function: same `dbInfo` computation, replace `dbPath: dbConfig.path` with `dbInfo`
- [x] In `src/routes/(app)/banned/users/+page.server.ts` load function: same `dbInfo` computation, replace `dbPath: dbConfig.path` with `dbInfo`
- [x] In `src/routes/(app)/banned/ip/+page.server.ts` load function: same `dbInfo` computation, replace `dbPath: dbConfig.path` with `dbInfo`

---

### Task 7: Update Svelte templates

**Files**: 4 Svelte page files

- [x] In `src/routes/(app)/totp/configurations/+page.svelte` (lines 51-56): remove the `{#if data.storageType && data.storageType !== 'sqlite'}` warning block entirely
- [x] In the same file (line 64): replace `{#if data.dbPath}` with `{#if data.dbInfo}` and `{m.database_label({ path: data.dbPath })}` with `{m.database_label({ info: data.dbInfo })}`
- [x] In `src/routes/(app)/totp/history/+page.svelte` (lines 35-40): remove the storage-not-supported warning block
- [x] In the same file (line 48): replace `data.dbPath` references with `data.dbInfo` and update `database_label` call parameter from `path` to `info`
- [x] In `src/routes/(app)/banned/users/+page.svelte` (lines 72-77): remove the storage-not-supported warning block
- [x] In the same file (line 85): replace `data.dbPath` references with `data.dbInfo` and update `database_label` call parameter
- [x] In `src/routes/(app)/banned/ip/+page.svelte` (lines 72-77): remove the storage-not-supported warning block
- [x] In the same file (line 85): replace `data.dbPath` references with `data.dbInfo` and update `database_label` call parameter

---

### Task 8: Update i18n messages

**Files**: `messages/en.json`, `messages/ru.json`

- [ ] In `messages/en.json`: change `"database_label": "Database: {path}"` to `"database_label": "Database: {info}"`
- [ ] In `messages/en.json`: change `"db_type_not_supported"` text from "Only SQLite is currently supported" to "Supported types: SQLite, PostgreSQL."
- [ ] In `messages/en.json`: change `"storage_not_supported_text"` text from "Only SQLite is currently supported" to "Supported types: SQLite, PostgreSQL."
- [ ] In `messages/en.json`: change `"db_type_not_supported_short"` text from "is not yet supported" to "is not supported"
- [ ] In `messages/ru.json`: change `"database_label": "База данных: {path}"` to `"database_label": "База данных: {info}"`
- [ ] In `messages/ru.json`: change `"db_type_not_supported"` text from "В настоящее время поддерживается только SQLite" to "Поддерживаемые типы: SQLite, PostgreSQL."
- [ ] In `messages/ru.json`: change `"storage_not_supported_text"` text from "В настоящее время поддерживается только SQLite" to "Поддерживаемые типы: SQLite, PostgreSQL."
- [ ] In `messages/ru.json`: change `"db_type_not_supported_short"` text from "пока не поддерживается" to "не поддерживается"

---

### Task 9: Create Authelia PostgreSQL test config

**Files**: `test-configs/authelia-pg/configuration.yml` (NEW)

- [ ] Create directory `test-configs/authelia-pg/`
- [ ] Copy `test-configs/authelia/configuration.yml` to `test-configs/authelia-pg/configuration.yml`
- [ ] Replace the `storage:` section: remove `local:` with `path: '/data/db.sqlite3'`
- [ ] Add `postgres:` subsection with `address: 'tcp://postgres:5432'`, `database: 'authelia'`, `schema: 'public'`, `username: 'authelia'`, `password: 'authelia_test_password'`, `timeout: '5s'`
- [ ] Keep `encryption_key` and all other sections (server, auth backend, session, regulation, notifier, etc.) identical

---

### Task 10: Create `docker-compose.test-pg.yml`

**Files**: `docker-compose.test-pg.yml` (NEW)

- [ ] Copy `docker-compose.test.yml` as the base
- [ ] Add `postgres` service with `image: 'postgres:18-alpine'`, `container_name: 'postgres'`, network alias `postgres`, env vars `POSTGRES_DB=authelia`, `POSTGRES_USER=authelia`, `POSTGRES_PASSWORD=authelia_test_password`
- [ ] Add healthcheck to `postgres` service: `pg_isready -U authelia -d authelia`, interval 5s, timeout 5s, retries 10
- [ ] Update `authelia` service `depends_on`: add `postgres: condition: service_healthy`
- [ ] Update `authelia` service `volumes`: change `'./test-configs/authelia:/config'` to `'./test-configs/authelia-pg:/config'`
- [ ] Remove `'./.test-data/authelia:/data'` volume from `authelia` service (PG doesn't need SQLite data dir)
- [ ] Update `authelia-admin` service `volumes`: change `'./test-configs/authelia:/config'` to `'./test-configs/authelia-pg:/config'`
- [ ] Remove `'./.test-data/authelia:/data'` volume from `authelia-admin` service
- [ ] Keep `lldap` and `traefik` services identical to `docker-compose.test.yml`

---

### Task 11: Update Makefile

**Files**: `Makefile`

- [ ] Add `DOCKER_TEST_PG_COMPOSE_FILE ?= docker-compose.test-pg.yml` variable near existing `DOCKER_TEST_COMPOSE_FILE`
- [ ] Add `test-e2e-pg-up` target: create `.test-data/lldap` dir, copy lldap config, run LLDAP bootstrap in background, `docker compose -f $(DOCKER_TEST_PG_COMPOSE_FILE) up -d`, run `wait-for-services.sh`
- [ ] Add `test-e2e-pg-down` target: `docker compose -f $(DOCKER_TEST_PG_COMPOSE_FILE) down`
- [ ] Update `test-e2e` target to run both stacks sequentially: Phase 1 (SQLite) runs existing stack + tests + teardown, captures exit code; Phase 2 (PostgreSQL) runs PG stack + same tests + teardown, captures exit code; fail if either exit code is non-zero

---

## Execution Order

Tasks 1-4 must be done first (core database layer). Tasks 5-8 can be done in parallel after 1-4. Tasks 9-11 (test infrastructure) can be done independently.

Recommended order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11

## Verification Steps

1. `npm run check` — TypeScript compilation passes
2. `npm run build` — Production build succeeds
3. `make test-e2e` (SQLite phase) — All existing E2E tests pass
4. `make test-e2e` (PG phase) — All same E2E tests pass against PostgreSQL
5. Manual: visit each database page, verify info banner shows correct storage info

## Files Summary

### Modified (13 files):
| File | Changes |
|------|---------|
| `package.json` | Add `pg`, `@types/pg` |
| `src/lib/server/database.ts` | New `PostgreSQLAdapter`, restructured `DatabaseConfig`, fixed `getDatabaseConfig()`, updated factory |
| `src/routes/(app)/totp/configurations/+page.server.ts` | Remove sqlite guard (2), dbPath → dbInfo |
| `src/routes/(app)/totp/history/+page.server.ts` | Remove sqlite guard (1), dbPath → dbInfo |
| `src/routes/(app)/banned/users/+page.server.ts` | Remove sqlite guard (3), dbPath → dbInfo |
| `src/routes/(app)/banned/ip/+page.server.ts` | Remove sqlite guard (3), dbPath → dbInfo |
| `src/routes/(app)/totp/configurations/+page.svelte` | Remove warning, dbPath → dbInfo |
| `src/routes/(app)/totp/history/+page.svelte` | Remove warning, dbPath → dbInfo |
| `src/routes/(app)/banned/users/+page.svelte` | Remove warning, dbPath → dbInfo |
| `src/routes/(app)/banned/ip/+page.svelte` | Remove warning, dbPath → dbInfo |
| `messages/en.json` | Update `database_label`, `db_type_not_supported`, `storage_not_supported_text` |
| `messages/ru.json` | Same |
| `Makefile` | New PG targets, updated `test-e2e` |

### Created (2 files):
| File | Purpose |
|------|---------|
| `test-configs/authelia-pg/configuration.yml` | Authelia config with PostgreSQL storage |
| `docker-compose.test-pg.yml` | PostgreSQL test stack |
