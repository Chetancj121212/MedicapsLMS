# 🛡️ Medicaps LMS — Comprehensive Security Task List & Audit Report

> **Audit Date:** October 11, 2026  
> **Target System:** Department of Electronics & Communication Engineering LMS (`Courseportel`)  
> **Status Summary:** Full-codebase deep audit completed. Tasks categorized into **✅ Implemented**, **⚠️ Partially Implemented**, and **❌ Pending / Vulnerabilities Identified**.

---

## 📊 Executive Summary Matrix

| # | Security Domain | Audit Status | Severity | Primary Files Affected |
|---|---|---|---|---|
| 1 | **Authentication** | ⚠️ Partial | **HIGH** | `app/routers/auth.py`, `app/services/auth_service.py`, `app/schemas/schemas.py` |
| 2 | **Master Admin Security** | ⚠️ Partial | **HIGH** | `app/routers/addadmins.py`, `app/routers/admin.py` |
| 3 | **Authorization & IDOR** | ⚠️ Partial | **CRITICAL** | `app/routers/courses.py`, `app/routers/lectures.py`, `app/routers/quizzes.py` |
| 4 | **Video Progress Anti-Cheat** | ❌ Vulnerable | **CRITICAL** | `app/services/progress_service.py`, `app/schemas/schemas.py` |
| 5 | **Sequential Course Unlocking** | ❌ Vulnerable | **HIGH** | `app/services/progress_service.py`, `app/routers/lectures.py` |
| 6 | **Quiz Integrity & Tampering** | ⚠️ Partial | **HIGH** | `app/services/quiz_service.py`, `app/routers/quizzes.py` |
| 7 | **Certificate Eligibility** | ✅ Solid | **LOW** | `app/services/eligibility_service.py`, `app/services/certificate_service.py` |
| 8 | **Certificate Verification & QR** | ⚠️ Partial | **MEDIUM** | `app/routers/certificates.py`, `app/services/certificate_service.py` |
| 9 | **Upload Security** | ⚠️ Partial | **HIGH** | `app/services/storage/local.py`, `app/routers/admin.py` |
| 10 | **API Validation & Hardening** | ⚠️ Partial | **MEDIUM** | `app/schemas/schemas.py`, `app/main.py` |
| 11 | **Rate Limiting & Throttling** | ❌ Missing | **CRITICAL** | `backend/requirements.txt`, `app/main.py`, `app/routers/` |
| 12 | **Cloudflare / Network Exposure** | ⚠️ Partial | **HIGH** | `docker-compose.yml`, `app/config.py` |
| 13 | **Secrets & Environment** | ⚠️ Action Needed | **HIGH** | `.env`, `docker-compose.yml`, `.gitignore` |
| 14 | **Docker Hardening** | ⚠️ Partial | **MEDIUM** | `backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml` |
| 15 | **PostgreSQL Isolation** | ❌ Vulnerable | **HIGH** | `docker-compose.yml` |
| 16 | **SQL Injection (SQLi)** | ✅ Secure | **LOW** | All routers & services (SQLAlchemy ORM parameterized) |
| 17 | **Cross-Site Scripting (XSS)** | ✅ Secure | **LOW** | Frontend Next.js components |
| 18 | **CSRF & Token Architecture** | ✅ Secure | **LOW** | Bearer token auth in headers (not ambient cookies) |
| 19 | **Security Headers** | ❌ Missing | **MEDIUM** | `backend/app/main.py`, `frontend/next.config.ts` |
| 20 | **Security Audit Logging** | ⚠️ Partial | **MEDIUM** | `app/models/audit.py`, `app/routers/` |
| 21 | **Information Leakage** | ⚠️ Partial | **MEDIUM** | `app/main.py` |
| 22 | **Health Check Safety** | ✅ Secure | **LOW** | `app/main.py` |
| 23 | **Backend & DB Uptime** | ❌ Missing | **LOW** | `app/main.py`, `app/database.py`, `app/banner.py` |
| 24 | **Zero-Trust Frontend Model** | ⚠️ Partial | **HIGH** | Architecture-wide |
| 25 | **Penetration Testing Verification** | ❌ Pending | **HIGH** | Test suite |

---

## Detailed Task Checklist & Findings

### 1. 🔐 Authentication (Priority: HIGHEST)
- [x] **Passwords hashed with bcrypt**: Uses `passlib.context.CryptContext(schemes=["bcrypt"])` (`auth_service.py:17`).
- [x] **Logout token invalidation**: Stores SHA-256 hash in `RevokedToken` table with expiry (`auth.py:140-159`).
- [x] **JWT expiration configured**: 60-minute access token expiry, 7-day refresh token expiry (`config.py:21-22`).
- [x] **No passwords or raw tokens in logs**: Verified across all backend handlers.
- [ ] **Login endpoint rate limiting**: `POST /api/auth/login` has no rate limiter; vulnerable to brute-force credential stuffing.
- [ ] **Account lockout / progressive delay**: No counter for consecutive failed logins in `User` model.
- [ ] **Prevent user enumeration on login**: Currently, inactive accounts return `403 Account is inactive` before password validation, confirming the account exists.
- [ ] **Strong password policy**:
  - `AdminCreate`: only checks `len >= 8` (no uppercase, number, or special char rule).
  - `StudentCreate`: **zero validation** (`password: str` accepts 1-character passwords).
  - CSV bulk import defaults to weak password `Medicaps@123`.
- [ ] **Refresh token rotation & reuse detection**: `/api/auth/refresh` returns a new refresh token but does **not** invalidate the old refresh token, leaving it active for 7 days.
- [ ] **Self-service password reset flow**: No student-facing password reset endpoint or secure short-lived token mechanism exists (only admin override in `admin.py`).
- [ ] **Granular RBAC enforcement in `/api/admin`**: Currently, `require_content_admin` allows `COURSE_INSTRUCTOR` and `DEPARTMENT_ADMIN` full access to student deletion, password resets, and certificate issuance/revocation. Needs role segregation.

---

### 2. 👑 Master Admin Security
- [x] **Master Admin role check**: Enforced via `require_master_admin` on all `/api/addadmins` routes (`addadmins.py:18`).
- [x] **Self-deactivation / Self-deletion prevention**: Prevents admins from locking themselves out (`addadmins.py:155, 169`).
- [x] **Last Master Admin safeguard**: Database count check prevents deleting/deactivating the sole active Master Admin (`addadmins.py:153, 176`).
- [x] **Master Admin audit logging**: Records admin creation, update, activation, deactivation, and deletion (`addadmins.py:58-65`).
- [ ] **Rate limiting on Master Admin routes**: No request rate limiting applied.
- [ ] **Master Admin password reset mechanism**: No isolated emergency recovery workflow for Master Admin accounts.

---

### 3. 🎟️ Authorization & IDOR
- [x] **Student profile isolation**: `GET /api/student/dashboard` and `GET /api/student/profile` bind strictly to `current_user.id`.
- [x] **Student certificate query isolation**: `GET /api/certificates/my-certificates` filters by `student.id` linked to `current_user.id`.
- [ ] **Enrollment check on curriculum learning**: `GET /api/courses/{course_id}/learn` does **not** verify whether the student is enrolled before returning course content (`courses.py:113-138`).
- [ ] **Enrollment check on eligibility check**: `GET /api/courses/{course_id}/eligibility` does not verify active enrollment.
- [ ] **Lecture progress IDOR**: `POST /api/lectures/{lecture_id}/progress` does not check if the lecture belongs to a course the student is enrolled in.
- [ ] **Quiz submission IDOR**: `POST /api/quizzes/{quiz_id}/submit` does not verify that the quiz belongs to a course the student is enrolled in.
- [ ] **Public certificate PDF download authorization**: `GET /api/certificates/{certificate_number}/download` does not verify if the certificate is revoked or owned by the requester before generating and serving it.

---

### 4. 🎥 Video Progress Anti-Cheat (Priority: CRITICAL)
- [x] **Dual requirement model**: Enforces both `watch % >= threshold` AND `active_screen_time >= 60% of duration` in logic (`progress_service.py:145-151`).
- [x] **Segment deduplication**: Overlapping video segments are merged with tolerance (`progress_service.py:17-53`).
- [ ] **VULNERABILITY — Server accepts forged progress values**:
  - `update_lecture_progress` uses `max()` on client-supplied `watched_seconds` and `active_screen_time_seconds`:
    ```python
    current_play_time = max(..., float(video_play_time_seconds or 0.0), float(watched_seconds or 0.0))
    current_active_time = max(..., float(active_screen_time_seconds or 0.0))
    ```
  - A malicious script can send `{"watched_seconds": 99999, "active_screen_time_seconds": 99999}` in a single POST and obtain instant completion.
- [ ] **Missing heartbeat delta validation**: Server must only accept incremental progress based on elapsed time since the previous recorded heartbeat (e.g. max 15s progress per 10s window).
- [ ] **Unvalidated negative or extreme values**: `LectureProgressUpdate` schema allows negative numbers and floats up to infinity (`schemas.py:431`).
- [ ] **Future timestamp acceptance**: `last_activity_at` sent by the client is accepted without checking against server `datetime.utcnow()`.

---

### 5. 🔓 Course Unlocking (Sequential Progression)
- [x] **Curriculum status calculation**: `get_course_curriculum_status` calculates `is_locked` based on preceding lecture and quiz completion (`progress_service.py:332`).
- [ ] **VULNERABILITY — Video URLs leaked in locked lecture responses**:
  - `items_status.append({"video_path": lec.video_path, "video_source_url": lec.video_source_url, "video_id": lec.video_id, ...})` leaks full video streams even when `is_locked: True` (`progress_service.py:346-353`).
  - Frontend merely hides the player; the raw video URLs are exposed to the browser inspect tools.
- [ ] **Backend gate on progress submission for locked lectures**: Calling `POST /api/lectures/{lecture_id}/progress` on a locked lecture currently succeeds instead of returning `403 Forbidden`.
- [ ] **Backend gate on quiz retrieval for locked quizzes**: Calling `GET /api/quizzes/{quiz_id}` on a locked module quiz currently returns questions instead of returning `403 Forbidden`.

---

### 6. 📝 Quiz Integrity & Anti-Tampering
- [x] **Correct answers stripped from client payload**: `QuizService.get_quiz_for_student` strips `is_correct` from options before sending to student (`quiz_service.py:64-78`).
- [x] **Server-authoritative scoring**: Score and percentage are calculated solely by comparing selected option IDs with database records (`quiz_service.py:127-157`).
- [x] **Tamper-proof score**: Student cannot submit score or passing status in the request body.
- [ ] **Enrollment verification before quiz access**: Student can take quizzes for courses they are not enrolled in.
- [ ] **Sequential unlocking verification before quiz access**: Student can bypass module lectures and attempt the quiz directly.
- [ ] **Race condition / duplicate submission protection**: No concurrency locking prevents rapid double-submits of the same quiz.
- [ ] **Max attempts loophole**: `get_quiz_for_student` permits students to view quiz questions beyond `max_attempts` if they previously passed (`quiz_service.py:47`).

---

### 7. 🏆 Final Evaluation & Certificate Generation
- [x] **Centralized eligibility verification**: `eligibility_service.py` is the single source of truth; checks all required lectures, module quizzes, and final assessments (`eligibility_service.py:130-279`).
- [x] **No public fabrication endpoint**: Students cannot call an arbitrary "make certificate" API without passing eligibility.
- [x] **Unique certificate numbering**: Formats sequentially as `ECE-YYYY-XXXXXX` (`certificate_service.py:32-55`).
- [ ] **Admin bypass auditing**: `POST /api/admin/certificates/issue` allows admins to manually issue certificates without eligibility verification; needs strict role check and detailed audit log.

---

### 8. 📜 Certificate Verification & QR Code Security
- [x] **Public verification endpoint**: `GET /api/certificates/verify/{certificate_number}` works without authentication (`certificates.py:21-25`).
- [x] **Data minimization in public verification**: Does not expose user password, email, user ID, internal database keys, or tokens (`certificate_service.py:360-374`).
- [x] **Revocation recognition**: Returns `valid: False` with custom university revocation message (`certificate_service.py:347-359`).
- [ ] **Revoked certificate download loophole**: `GET /api/certificates/{certificate_number}/download` serves the PDF even if `is_revoked: True`. It should either return 403 or stamp a "REVOKED" watermark.
- [ ] **Rate limiting on verification endpoint**: `/api/certificates/verify/*` is unprotected against enumeration brute-forcing.

---

### 9. 📁 Upload Security
- [x] **Server-side filename generation**: Files are saved with random `uuid4().hex` filenames; user-supplied filenames are not used as filesystem paths (`storage/local.py:21`).
- [x] **Directory traversal prevention**: User filenames cannot traverse directories due to UUID replacement.
- [ ] **Missing file signature / MIME verification**: Video uploads only check `.endswith(".mp4")`; file content magic bytes (e.g. `ftypmp42`) are not verified.
- [ ] **Missing upload file size limit enforcement**: `MAX_VIDEO_SIZE_MB = 500` is in settings but not enforced during file streaming; unbounded uploads can cause disk exhaustion.
- [ ] **CSV import denial of service**: `import_students_csv` loads entire file into memory with `await file.read()` without size checks.
- [ ] **Static mount file execution risk**: `/uploads` is mounted directly with `StaticFiles`. Uploaded SVG or HTML files could lead to stored XSS if directly browsed.

---

### 10. 🛡️ API Security & Input Validation
- [x] **Pydantic schema validation**: Used across endpoints for payload structure.
- [ ] **String length and regex boundaries**: Several fields (e.g. full names, titles, descriptions) lack `max_length` and character sanitization.
- [ ] **JSON payload size limits**: No middleware to reject oversized JSON bodies.

---

### 11. 🚨 Rate Limiting (Priority: CRITICAL)
- [ ] **Missing SlowAPI / Limiter library**: No rate limiting framework installed in `backend/requirements.txt`.
- [ ] **Brute-force protection on `/api/auth/login`**: Unlimited attempts allowed per IP and per username.
- [ ] **Brute-force protection on `/api/certificates/verify/*`**: Unlimited verification queries allowed.
- [ ] **Spam protection on `/api/quizzes/{id}/submit`**: Unlimited rapid submits allowed.
- [ ] **Protection on `/api/admin/*` and `/api/addadmins`**: Needs administrative rate limiting per IP/token.

---

### 12. 🌐 Cloudflare / HTTPS & Network Architecture
- [x] **CORS origins whitelist**: Enforces allowed domains + localhost in development (`config.py:35-56`, `main.py:56-64`).
- [x] **No wildcards with credentials**: Does not use `allow_origins=["*"]` when `allow_credentials=True`.
- [ ] **Direct PostgreSQL port exposure**: `docker-compose.yml` maps `"${POSTGRES_PORT:-5432}:5432"`, exposing the database to all network interfaces.
- [ ] **Direct Backend port exposure**: `docker-compose.yml` maps `8000:8000` publicly instead of binding strictly to `127.0.0.1` or internal Docker network behind Cloudflare Tunnel.

---

### 13. 🔑 Secrets & Environment Integrity
- [x] **Git repository clean**: No `.env` files containing secrets have ever been committed to Git.
- [x] **`.gitignore` protects environment files**: Excludes `.env`, `.env.*`, `data/*`, `*.db`.
- [ ] **Default secrets in local configuration**: Current `.env` and `docker-compose.yml` contain fallback secrets (`POSTGRES_PASSWORD=postgres`, `SECRET_KEY=replace-with-a-long-random-secret`).
- [ ] **Production startup validation**: Application starts even with insecure or default `SECRET_KEY`; needs strict production startup check that halts if `SECRET_KEY` is trivial or missing.

---

### 14. 🐳 Docker Hardening
- [x] **Minimal base images**: Uses `python:3.12-slim` and `node:22-alpine`.
- [x] **Health checks configured**: Configured in `Dockerfile` and `docker-compose.yml`.
- [x] **Restart policies active**: `restart: unless-stopped` enabled.
- [ ] **Containers run as root**:
  - `backend/Dockerfile` runs as `root` (needs `useradd -m -u 1000 appuser && USER appuser`).
  - `frontend/Dockerfile` runs as `root` (needs `USER node`).
- [ ] **Read-only root filesystem**: Containers do not specify `read_only: true` with tmpfs mounts.

---

### 15. 🗄️ PostgreSQL Hardening
- [x] **Connection pooling and graceful shutdown**: Handled with `create_async_engine` and `lifespan` disposal (`main.py:45`).
- [x] **Health check queries safe**: Uses `SELECT 1` in `check_database_health()`.
- [ ] **PostgreSQL port published to host**: Remove host port mapping from `docker-compose.yml` so only the internal Docker network can reach port 5432.
- [ ] **Superuser in application config**: FastAPI connects as `postgres` superuser instead of a dedicated least-privilege `lms_user`.

---

### 16. 💉 SQL Injection Audit
- [x] **No raw SQL string concatenation**: Thorough codebase audit confirmed 100% of queries use SQLAlchemy async ORM methods (`select()`, `where()`, `or_()`, `and_()`).
- [x] **Zero instances of `f"SELECT... {user_input}"`**: No raw execution found.

---

### 17. 🧪 Cross-Site Scripting (XSS) Audit
- [x] **No `dangerouslySetInnerHTML`**: Grep audit across `frontend/src` returned zero usages.
- [x] **No raw DOM manipulation**: No `innerHTML`, `outerHTML`, or `eval()`.
- [x] **React auto-escaping**: All course, user, and quiz titles are passed as standard React children.

---

### 18. 🔒 CSRF & Token Architecture
- [x] **Token transport model**: API relies strictly on `Authorization: Bearer <token>` HTTP headers.
- [x] **No ambient cookie authorization**: Browsers do not automatically attach tokens on cross-site requests.
- [ ] **Local storage XSS risk**: Tokens stored in `localStorage` in `frontend/src/lib/auth.tsx`. (Mitigated by preventing XSS, but httpOnly cookie migration is an optional consideration).

---

### 19. 🔐 Security Headers
- [ ] **Missing FastAPI security headers middleware**: Neither `main.py` nor routers set:
  - `Content-Security-Policy` (must allow YouTube iframe embeds: `frame-src https://www.youtube.com https://www.youtube-nocookie.com;`)
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- [ ] **Missing Next.js security headers**: `next.config.ts` has no `headers()` configuration.

---

### 20. 📊 Audit Logging
- [x] **AuditLog model exists**: `audit_logs` table stores `actor_user_id`, `action`, `affected_record`, `metadata_json`, `created_at` (`audit.py:8-16`).
- [x] **Admin account operations audited**: User create, update, deactivate, activate, delete logged (`addadmins.py:58-65`).
- [x] **Student & Certificate admin actions audited**: Student creation, deletion, certificate revocation/issue logged (`admin.py:803, 877, 1122, 1150`).
- [ ] **Missing client IP and User-Agent**: `AuditLog` table lacks `ip_address` and `user_agent` columns.
- [ ] **Missing authentication events**: No audit logs for `LOGIN_SUCCESS`, `LOGIN_FAILURE`, `LOGOUT`, or `PASSWORD_RESET`.
- [ ] **Missing quiz attempt logging**: Quiz submissions and grades are recorded in `quiz_attempts` but not in the unified security audit log.

---

### 21. 🔍 Information Leakage & Production Hardening
- [ ] **Interactive API Docs exposed**: `/docs`, `/redoc`, and `/openapi.json` are enabled on all environments. Should be disabled when `ENVIRONMENT=production`.
- [ ] **Uncaught Exception Handler**: No custom 500 error handler in FastAPI; unhandled exceptions can leak Python tracebacks and library internals.

---

### 22. 🩺 Health Endpoint Safety
- [x] **Minimal health endpoint**: `GET /api/health` returns only `status`, `database` connectivity status, institution, and department (`main.py:138-146`). No internal IPs, ports, usernames, or database connection strings are exposed.

---

### 23. ⏱️ Backend & DB Uptime Implementation
- [ ] **Backend process uptime**: No tracking of `backend_started_at` in application state; root banner and health check don't show formatted API uptime (`Xd Xh Xm`).
- [ ] **PostgreSQL engine uptime**: No query fetching PostgreSQL start time (`SELECT pg_postmaster_start_time()`) to report real DB uptime.

---

### 24. 🚫 Zero-Trust Frontend Enforcement Summary
The audit confirms that the following 4 critical server-side gates are currently relying on frontend honor system:
1. **Video watched & active screen time increments** (client can POST fabricated numbers).
2. **Sequential lecture video access** (video URLs are delivered even for locked lectures).
3. **Quiz attempt gating** (unlocked for un-enrolled students and out-of-order access).
4. **Revoked certificate download gating** (revoked certificates still download).

---

## 🎯 Recommended Action Plan (Grouped by Urgency)

### 🔴 Phase 1: Critical LMS Integrity Fixes (Must-have before opening)
1. **Fix Video Progress Anti-Cheat**:
   - Enforce server-authoritative incremental progress: validate that `watched_seconds` and `active_screen_time` cannot increase faster than real elapsed time between heartbeats.
   - Validate input bounds in `LectureProgressUpdate` (`ge=0`, `le=lecture.duration`).
   - Check that student is enrolled before accepting progress.
2. **Enforce Sequential Course Unlocking on Backend**:
   - Strip `video_path`, `video_source_url`, and `video_id` from API responses when `is_locked: True`.
   - Return `403 Forbidden` if a student attempts to POST progress on a locked lecture.
3. **Enforce Quiz Enrollment & Prerequisite Access**:
   - Verify active enrollment before allowing quiz access or submission.
   - Enforce sequential prerequisites before allowing quiz access.
4. **Add Rate Limiting (SlowAPI)**:
   - Install `slowapi`.
   - Protect `/api/auth/login` (5/min per IP/username), `/api/certificates/verify/*` (30/min), `/api/quizzes/{id}/submit` (10/min).

### 🟠 Phase 2: Authentication & RBAC Hardening
5. **Enforce RBAC within `/api/admin`**:
   - Split `require_content_admin` into role-specific dependencies:
     - `require_instructor`: manage only own courses and lectures.
     - `require_dept_admin`: manage department courses and students.
     - `require_master_admin`: delete students, reset admin passwords, issue manual certificates.
6. **Password Policy & Lockout**:
   - Add strong password validator for student and admin creation (min 8 chars, uppercase, lowercase, digit).
   - Add progressive delay / account lockout after 5 consecutive failed login attempts.
   - Implement refresh token rotation (revoke old refresh token upon `/refresh`).

### 🟡 Phase 3: Infrastructure, Docker & Network Hardening
7. **PostgreSQL & Docker Network Isolation**:
   - Remove `ports: - "${POSTGRES_PORT:-5432}:5432"` from `docker-compose.yml`.
   - Bind backend port `8000` to `127.0.0.1:8000` or expose only through Cloudflare Tunnel.
   - Update `backend/Dockerfile` and `frontend/Dockerfile` to run as non-root users.
8. **Disable API Docs & Add Error Handlers**:
   - In `main.py`, disable `docs_url`, `redoc_url`, `openapi_url` when `ENVIRONMENT=production`.
   - Add global 500 exception handler returning generic `{"detail": "Internal server error"}`.
9. **Add Security Headers Middleware**:
   - Inject CSP (with YouTube iframe allowance), HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`.
10. **Implement Backend & DB Uptime**:
    - Record `backend_started_at` in lifespan.
    - Query `pg_postmaster_start_time()` in health/root endpoints and display clean uptime.

---
*Task list generated and verified against repository source code.*
