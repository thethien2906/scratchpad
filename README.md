# Erwining — Agent Handover Reference

Dual-target minimalist dark-theme scratchpad, project notes, and weekly schedule app:
- **Web (Self-host VPS):** React + TypeScript + Vite SPA served by a single Rust **Axum + SQLite** binary (`server/`), with Netflix-style profile selection, 4-digit PIN auth, and a hidden developer console for profile creation.
- **Desktop (Tauri v2):** Same React frontend (`src/`) talking to local SQLite via Tauri IPC (`src-tauri/`). Desktop bypasses profile auth completely.

---

## Repository Map

- `src/` — Shared React 18 + TypeScript + Tailwind CSS frontend:
  - `src/App.tsx` — Entrypoint. If `isTauri`, mounts `<Workspace />` directly. On Web, mounts `<WebApp />` with `DevConsole`, `CreateProfileView`, `ProfileGate`, and `<Workspace key={currentProfile.id} />`. Exposes `workspaceFlushRef` so logout and console transitions flush pending auto-saves in both `Editor` and `ScheduleView`.
  - `src/services/api.ts` — Environment adapter (`isTauri` checks `'__TAURI_INTERNALS__' in window`). All Tauri calls live here; Web branch uses `apiFetch` (`credentials: 'include'`) and triggers global `setUnauthorizedHandler` on `401` (except `/api/auth/unlock` and `/api/auth/me`).
  - `src/components/ProfileGate.tsx` — Web profile picker + 4-digit PIN modal (auto-focus, auto-advance, paste, auto-submit on 4th digit, `429` countdown). Intentionally has **no** public "Create Profile" button.
  - `src/components/DevConsole.tsx` — Drop-down CS/GTA-style console toggled via `e.code === 'Backquote'` (`Ctrl + Backquote` when focused inside `<input>`/`<textarea>`/`contentEditable`). Commands: `create_profile`, `lock`, `logout`, `help`, `clear`, `close`, `exit`.
  - `src/components/CreateProfileView.tsx` — Profile creation screen reachable only via `create_profile` in `DevConsole`. Requires `name`, `avatar_color`, 4-digit `pin` + confirmation, and `admin_secret`.
  - `src/components/Sidebar.tsx` — Navigation (`Creative Mode`, `Schedule Mode`, `Projects`) + Web-only bottom profile badge & Lock/Switch button.
  - `src/components/Editor.tsx`, `src/components/ScheduleView.tsx`, `src/components/SaveStatus.tsx` — Core workspace views. `ScheduleView` exposes `ScheduleViewHandle.flush()` via `forwardRef`.
  - `src/hooks/useAutoSave.ts`, `src/hooks/useProjects.ts` — Debounced auto-save (500ms) and project list state.
  - `src/types/index.ts` — Shared TypeScript interfaces (`Project`, `ProjectSummary`, `ProfileSummary`, `ApiError`, `ActiveView`, `ScheduleData`).
- `server/` — Standalone Rust crate (`erwining-server`, Axum 0.7 + `rusqlite` bundled):
  - `server/src/main.rs` — Server bootstrap, tracing, DB open, binds `0.0.0.0:{PORT}` with `into_make_service_with_connect_info::<SocketAddr>()`.
  - `server/src/config.rs` — Env config loader (`PORT`, `DATABASE_PATH`, `STATIC_DIR`, `COOKIE_SECURE`, `SESSION_TTL_DAYS`, `ADMIN_SECRET`).
  - `server/src/db.rs` — SQLite WAL wrapper (`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;`), schema init, and strictly `profile_id`-scoped CRUD methods.
  - `server/src/auth.rs` — `AuthenticatedProfile` Axum extractor (validates `erwining_session` cookie against SHA-256 hash in `sessions`), `validate_pin` (`^\d{4}$`), Argon2 hash/verify, `PinRateLimiter` (5 failures per `(client_ip, profile_id)` -> 300s lockout -> HTTP `429`), `client_ip` helper (`X-Forwarded-For` / `X-Real-IP` -> `ConnectInfo`).
  - `server/src/routes/` — `mod.rs` (mounts `/api/*` + `ServeDir` fallback to `index.html`), `profiles.rs`, `auth_routes.rs`, `scratchpad.rs`, `projects.rs`, `schedules.rs`.
  - `server/tests/api.rs` — End-to-end Axum integration tests (admin secret, 4-digit PIN, rate-limiting, HttpOnly cookie, profile isolation & IDOR checks, logout, SPA fallback).
- `src-tauri/` — Tauri v2 desktop backend (`commands.rs`, `db.rs`, `models.rs`). Independent single-user local SQLite DB.
- Deployment files:
  - `Dockerfile` — 3-stage build (`node:20-alpine` -> `rust:1-bookworm` -> `debian:bookworm-slim`), runs as non-root `1000:1000`, serves both API and `dist/` from `/app/erwining-server`.
  - `docker-compose.yml` — Binds `${BIND_HOST:-127.0.0.1}:${PORT:-8080}:${PORT:-8080}`, mounts `./data:/app/data`, passes `APP_UID`/`APP_GID` and env config.
  - `.env.example` — Env template (`.env` is gitignored).
  - `deploy.sh` — VPS deployment script (`git pull --rebase`, `mkdir -p data`, `docker compose up -d --build --remove-orphans` with current host `APP_UID`/`APP_GID`).
  - `vite.config.ts` — Dev server on `:1420`, proxies `/api` to `http://127.0.0.1:8080`, ignores `**/src-tauri/**` and `**/server/**` in file watcher.

---

## Database Schema (`server/src/db.rs`)

All user data tables reference `profiles(id) ON DELETE CASCADE`:
- `profiles (id, name UNIQUE, avatar_color, pin_hash, created_at, updated_at)`
- `sessions (token_hash PRIMARY KEY, profile_id, expires_at, created_at)`
- `general_scratchpad (profile_id PRIMARY KEY, content, updated_at)`
- `projects (id, profile_id, name, content, created_at, updated_at)` — indexed on `(profile_id, updated_at DESC, id DESC)`
- `schedules (profile_id, key, content, updated_at, PRIMARY KEY (profile_id, key))`

---

## REST API Surface (`server/src/routes/mod.rs`)

### Public
- `GET /api/profiles` -> `ProfilePublic[]` (`id`, `name`, `avatar_color`; never `pin_hash`)
- `POST /api/profiles` -> `{ name, avatar_color?, pin, admin_secret }` -> `201` (`403 ADMIN_SECRET_INVALID` if secret mismatches `ADMIN_SECRET`, `400` invalid name/PIN, `409` duplicate name)
- `POST /api/auth/unlock` -> `{ profile_id, pin }` -> `200` + `Set-Cookie: erwining_session=...; HttpOnly; SameSite=Lax; Path=/` (`401` wrong PIN, `429` with `retry_after_seconds`)
- `GET /api/auth/me` -> `200` `ProfilePublic` or `401`
- `POST /api/auth/logout` -> `204` + clears cookie + deletes session row

### Protected (requires valid `erwining_session` cookie via `AuthenticatedProfile`)
- `PATCH /api/profiles/current` — update `name`, `avatar_color`, or PIN (`current_pin` + `new_pin`)
- `DELETE /api/profiles/current` — `{ pin }` -> `204` + deletes profile & clears cookie
- `GET /api/scratchpad`, `PUT /api/scratchpad` (`{ content }`)
- `GET /api/projects`, `POST /api/projects` (`{ name }`)
- `GET /api/projects/:id`, `DELETE /api/projects/:id`
- `GET /api/projects/:id/content`, `PUT /api/projects/:id/content` (`{ content }`)
- `PATCH /api/projects/:id/name` (`{ name }`)
- `GET /api/schedules/:key`, `PUT /api/schedules/:key` (`{ content }`), `DELETE /api/schedules/:key`

---

## Environment Variables

| Variable | Default | Notes |
| --- | --- | --- |
| `BIND_HOST` | `127.0.0.1` | Host bind in `docker-compose.yml` (keep `127.0.0.1` behind reverse proxy so `X-Forwarded-For` cannot be spoofed directly) |
| `PORT` | `8080` | Container & published HTTP port |
| `DATABASE_PATH` | `./data/erwining.db` (`/app/data/erwining.db` in Docker) | SQLite file path |
| `STATIC_DIR` | `./dist` (`/app/dist` in Docker) | Built Vite frontend directory |
| `COOKIE_SECURE` | `false` | Set `true` behind HTTPS reverse proxy |
| `SESSION_TTL_DAYS` | `30` | Session cookie & DB expiry |
| `ADMIN_SECRET` | `create_profile` | Required by `POST /api/profiles` |
| `APP_UID` / `APP_GID` | `1000` / `1000` | Container user IDs for `./data` write access |

---

## Dev, Build & Verification Commands

- **Web dev (2 terminals):**
  - Backend: `cd server && cargo run` (listens on `:8080`)
  - Frontend: `npm run dev` (listens on `:1420`, proxies `/api` -> `:8080`)
- **Backend tests:** `cd server && cargo test`
- **Frontend typecheck & build:** `npm run build`
- **Desktop Tauri check / dev / build:** `cd src-tauri && cargo check` / `npm run tauri dev` / `npm run tauri build`
- **Docker validation & deploy:** `docker compose config` / `./deploy.sh`

---

## Invariants (Do Not Break)

1. **Dual-target parity:** Never remove or break `isTauri` branches in `src/services/api.ts` or `src/App.tsx`; never import Web-only modules inside `src-tauri/`.
2. **Strict tenant isolation:** Every protected DB query in `server/src/db.rs` must scope by `authenticated.profile_id` from the session extractor—never trust a client-supplied `profile_id` for data routes.
3. **No public profile creation UI:** Profile creation must remain hidden behind `DevConsole` (`Backquote` -> `create_profile`) and enforced server-side by `ADMIN_SECRET`.
4. **4-digit PIN contract:** Both frontend inputs (`ProfileGate.tsx`, `CreateProfileView.tsx`) and backend `validate_pin` enforce exactly 4 ASCII digits.
5. **Flush before profile transition:** Keep `workspaceFlushRef` wired so switching/locking via Sidebar or `DevConsole` flushes `Editor` and `ScheduleView` before logout/unmount.
