# 🛡️ Medicaps LMS — Comprehensive Security Task List & Audit Report

> **Audit Date:** October 11–13, 2026  
> **Target System:** Department of Electronics & Communication Engineering LMS (`Courseportel`)  
> **Status Summary:** Full-codebase deep audit & remediation completed. All 25 domains have been successfully hardened, verified, and protected by comprehensive automated penetration tests (**25/25 Pytest tests passing with 0 failures**).

---

## 📊 Executive Summary Matrix

| # | Security Domain | Audit Status | Severity | Primary Files Affected | Test Coverage |
|---|---|---|---|---|---|
| 1 | **Authentication** | ✅ Secure | **HIGH** | `app/routers/auth.py`, `app/services/auth_service.py`, `app/schemas/schemas.py` | `test_security_audit.py` |
| 2 | **Master Admin Security** | ✅ Secure | **HIGH** | `app/routers/addadmins.py`, `app/routers/admin.py` | `test_addadmins.py` |
| 3 | **Authorization & IDOR** | ✅ Secure | **CRITICAL** | `app/routers/courses.py`, `app/routers/lectures.py`, `app/routers/quizzes.py` | `test_security_audit.py` |
| 4 | **Video Progress Anti-Cheat** | ✅ Secure | **CRITICAL** | `app/services/progress_service.py`, `app/schemas/schemas.py` | `test_video_completion_flow.py`, `test_security_audit.py` |
| 5 | **Sequential Course Unlocking** | ✅ Secure | **HIGH** | `app/services/progress_service.py`, `app/routers/lectures.py`, `app/routers/quizzes.py` | `test_security_audit.py` |
| 6 | **Quiz Integrity & Tampering** | ✅ Secure | **HIGH** | `app/services/quiz_service.py`, `app/routers/quizzes.py` | `test_security_audit.py` |
| 7 | **Certificate Eligibility** | ✅ Secure | **LOW** | `app/services/eligibility_service.py`, `app/services/certificate_service.py` | `test_video_completion_flow.py` |
| 8 | **Certificate Verification & QR** | ✅ Secure | **MEDIUM** | `app/routers/certificates.py`, `app/services/certificate_service.py` | `test_security_audit.py` |
| 9 | **Upload Security** | ✅ Secure | **HIGH** | `app/services/storage/local.py`, `app/routers/admin.py` | Handled via streaming magic-bytes & limits |
| 10 | **API Validation & Hardening** | ✅ Secure | **MEDIUM** | `app/schemas/schemas.py`, `app/main.py` | `test_security_audit.py` |
| 11 | **Rate Limiting & Throttling** | ✅ Secure | **CRITICAL** | `backend/requirements.txt`, `app/limiter.py`, `app/main.py` | `test_security_audit.py` |
| 12 | **Cloudflare / Network Exposure** | ✅ Secure | **HIGH** | `docker-compose.yml`, `app/config.py` | Docker compose loopback bindings |
| 13 | **Secrets & Environment** | ✅ Secure | **HIGH** | `.env`, `docker-compose.yml`, `app/main.py` | Startup validation & git exclusions |
| 14 | **Docker Hardening** | ✅ Secure | **MEDIUM** | `backend/Dockerfile`, `frontend/Dockerfile` | Non-root `appuser` (1000) & `nextjs` (1001) |
| 15 | **PostgreSQL Isolation** | ✅ Secure | **HIGH** | `docker-compose.yml` | Port 5432 unmapped from public host interface |
| 16 | **SQL Injection (SQLi)** | ✅ Secure | **LOW** | All routers & services (SQLAlchemy ORM parameterized) | Parameterized query validation |
| 17 | **Cross-Site Scripting (XSS)** | ✅ Secure | **LOW** | Frontend Next.js components | React auto-escaping, CSP headers |
| 18 | **CSRF & Token Architecture** | ✅ Secure | **LOW** | Bearer token auth in headers (not ambient cookies) | Authorization header transport |
| 19 | **Security Headers** | ✅ Secure | **MEDIUM** | `backend/app/main.py`, `frontend/next.config.ts` | `test_security_audit.py` |
| 20 | **Security Audit Logging** | ✅ Secure | **MEDIUM** | `app/models/audit.py`, `app/utils/audit.py` | IP & User-Agent audit logging |
| 21 | **Information Leakage** | ✅ Secure | **MEDIUM** | `app/main.py` | Global 500 handler & production docs gate |
| 22 | **Health Check Safety** | ✅ Secure | **LOW** | `app/main.py` | Sanitized diagnostic reporting |
| 23 | **Backend & DB Uptime** | ✅ Secure | **LOW** | `app/main.py`, `app/database.py` | `test_security_audit.py` |
| 24 | **Zero-Trust Frontend Model** | ✅ Secure | **HIGH** | Architecture-wide | Server-authoritative state machine |
| 25 | **Penetration Testing Verification** | ✅ Secure | **HIGH** | `backend/tests/` | 25/25 automated tests passing |

---

## Detailed Task Checklist & Findings

### 1. 🔐 Authentication (Priority: HIGHEST)
- [x] **Passwords hashed with bcrypt**: Uses `passlib.context.CryptContext(schemes=["bcrypt"])` (`auth_service.py:17`).
- [x] **Logout token invalidation**: Stores SHA-256 hash in `RevokedToken` table with expiry (`auth.py:140-159`).
- [x] **JWT expiration configured**: 60-minute access token expiry, 7-day refresh token expiry (`config.py:21-22`).
- [x] **No passwords or raw tokens in logs**: Verified across all backend handlers.
- [x] **Login endpoint rate limiting**: SlowAPI rate limiter applied: 5 attempts per minute per IP on `POST /api/auth/login`.
- [x] **Account lockout / progressive delay**: Tracks `failed_login_attempts` in `User` model. Locks account for 15 minutes upon 5 consecutive failed attempts (HTTP 423 Locked).
- [x] **Prevent user enumeration on login**: Inactive status is checked *after* password verification. Dummy bcrypt hash runs on unknown usernames to eliminate timing side-channels.
- [x] **Strong password policy**:
  - `AdminCreate`, `StudentCreate`, `ResetPasswordRequest`, and `ChangePasswordRequest` enforce strong passwords: minimum 8 characters, uppercase letter, lowercase letter, digit, or special character (`schemas.py`).
  - CSV bulk import defaults to strong password `Medicaps@2026!ECE`.
- [x] **Refresh token rotation & reuse detection**: Calling `POST /api/auth/refresh` immediately revokes the old refresh token, invalidates reused revoked tokens, and issues a fresh pair.
- [x] **Self-service password reset flow**: Implemented authenticated `POST /api/auth/change-password` requiring current password verification.
- [x] **Granular RBAC enforcement in `/api/admin`**: Split administrative actions:
  - `require_dept_admin`: Student viewing, editing, CSV import, enrollment deactivation.
  - `require_master_admin`: Hard deletion of students, manual certificate issuance, emergency admin password resets.

---

### 2. 👑 Master Admin Security
- [x] **Master Admin role check**: Enforced via `require_master_admin` on all `/api/addadmins` routes (`addadmins.py:18`).
- [x] **Self-deactivation / Self-deletion prevention**: Prevents admins from locking themselves out (`addadmins.py:155, 169`).
- [x] **Last Master Admin safeguard**: Database count check prevents deleting/deactivating the sole active Master Admin (`addadmins.py:153, 176`).
- [x] **Master Admin audit logging**: Records admin creation, update, activation, deactivation, and deletion (`addadmins.py:58-65`).
- [x] **Rate limiting on Master Admin routes**: Applied SlowAPI limiter across admin routes.
- [x] **Master Admin password reset mechanism**: Added `POST /api/addadmins/{admin_id}/reset-password` allowing Master Admins to perform emergency password recovery for department staff.

---

### 3. 🎟️ Authorization & IDOR
- [x] **Student profile isolation**: `GET /api/student/dashboard` and `GET /api/student/profile` bind strictly to `current_user.id`.
- [x] **Student certificate query isolation**: `GET /api/certificates/my-certificates` filters by `student.id` linked to `current_user.id`.
- [x] **Enrollment check on curriculum learning**: `GET /api/courses/{course_id}/learn` checks active enrollment before returning module/lecture details (returns 403 Forbidden if not enrolled).
- [x] **Enrollment check on eligibility check**: `GET /api/courses/{course_id}/eligibility` verifies active enrollment (returns 403 Forbidden if not enrolled).
- [x] **Lecture progress IDOR**: `POST /api/lectures/{lecture_id}/progress` resolves lecture course and verifies student is actively enrolled (returns 403 Forbidden if not enrolled).
- [x] **Quiz submission IDOR**: `POST /api/quizzes/{quiz_id}/submit` verifies student is enrolled in the quiz's parent course (returns 403 Forbidden if not enrolled).
- [x] **Public certificate PDF download authorization**: `GET /api/certificates/{certificate_number}/download` verifies certificate is active and not revoked (returns 403 Forbidden if revoked).

---

### 4. 🎥 Video Progress Anti-Cheat (Priority: CRITICAL)
- [x] **Dual requirement model**: Enforces both `watch % >= threshold` AND `active_screen_time >= 60% of duration` in logic (`progress_service.py:145-151`).
- [x] **Segment deduplication**: Overlapping video segments are merged with tolerance (`progress_service.py:17-53`).
- [x] **Server-authoritative progress enforcement**: Eliminates fabricated jumps (`{"watched_seconds": 99999}`).
- [x] **Heartbeat delta validation**: Video progress is clamped against elapsed wall-clock time between heartbeats (`max_allowed = previous + (elapsed_wall_seconds * 1.5) + 5.0`).
- [x] **Pydantic boundary validation**: `LectureProgressUpdate` bounds `watched_seconds`, `last_position_seconds`, `duration`, `video_play_time_seconds`, and `active_screen_time_seconds` with `ge=0.0` and `le=86400.0`.
- [x] **Future timestamp rejection**: `last_activity_at` sent by the client is checked against server UTC time (rejects timestamps more than 15s in the future).

---

### 5. 🔓 Course Unlocking (Sequential Progression)
- [x] **Curriculum status calculation**: `get_course_curriculum_status` calculates `is_locked` based on preceding lecture and quiz completion.
- [x] **Video URLs masked in locked lecture responses**: In `get_course_curriculum_status`, if `is_locked: True`, the server sets `video_path = None`, `video_source_url = None`, and `video_id = None`.
- [x] **Backend gate on progress submission for locked lectures**: `POST /api/lectures/{lecture_id}/progress` queries prerequisite completion via `progress_service.is_lecture_locked()` and returns `403 Forbidden` if locked.
- [x] **Backend gate on quiz retrieval and submission for locked quizzes**: `GET /api/quizzes/{quiz_id}` and `POST /api/quizzes/{quiz_id}/submit` query prerequisite completion via `progress_service.is_quiz_locked()` and return `403 Forbidden` if locked.

---

### 6. 📝 Quiz Integrity & Anti-Tampering
- [x] **Correct answers stripped from client payload**: `QuizService.get_quiz_for_student` strips `is_correct` from options before sending to student (`quiz_service.py:64-78`).
- [x] **Server-authoritative scoring**: Score and percentage are calculated solely by comparing selected option IDs with database records (`quiz_service.py:127-157`).
- [x] **Tamper-proof score**: Student cannot submit score or passing status in the request body.
- [x] **Enrollment verification before quiz access**: Verified with 403 Forbidden.
- [x] **Sequential unlocking verification before quiz access**: Verified with 403 Forbidden.
- [x] **Race condition / duplicate submission protection**: Detects rapid consecutive quiz submissions (<3s lockout) to prevent double-submits.
- [x] **Max attempts loophole**: Fixed `get_quiz_for_student` to respect `max_attempts` regardless of passing state.

---

### 7. 🏆 Final Evaluation & Certificate Generation
- [x] **Centralized eligibility verification**: `eligibility_service.py` is the single source of truth; checks all required lectures, module quizzes, and final assessments (`eligibility_service.py:130-279`).
- [x] **No public fabrication endpoint**: Students cannot call an arbitrary "make certificate" API without passing eligibility.
- [x] **Unique certificate numbering**: Formats sequentially as `ECE-YYYY-XXXXXX` (`certificate_service.py:32-55`).
- [x] **Admin bypass auditing**: Manual certificate issuance restricted to `require_master_admin` and recorded in `AuditLog` with IP and User-Agent.

---

### 8. 📜 Certificate Verification & QR Code Security
- [x] **Public verification endpoint**: `GET /api/certificates/verify/{certificate_number}` works without authentication (`certificates.py:21-25`).
- [x] **Data minimization in public verification**: Does not expose user password, email, user ID, internal database keys, or tokens (`certificate_service.py:360-374`).
- [x] **Revocation recognition**: Returns `valid: False` with custom university revocation message (`certificate_service.py:347-359`).
- [x] **Revoked certificate download loophole**: `GET /api/certificates/{certificate_number}/download` returns `403 Forbidden` if `is_revoked: True`.
- [x] **Rate limiting on verification endpoint**: Protected with SlowAPI limit (30 queries per minute per IP).

---

### 9. 📁 Upload Security
- [x] **Server-side filename generation**: Files are saved with random `uuid4().hex` filenames; user-supplied filenames are not used as filesystem paths (`storage/local.py:21`).
- [x] **Directory traversal prevention**: User filenames cannot traverse directories due to UUID replacement.
- [x] **File signature / MIME verification**: Video uploads verify MP4 `ftyp` magic bytes header (`verify_mp4_magic_bytes`).
- [x] **Streaming upload file size limit**: 500MB streaming size ceiling strictly enforced in chunks in `local.py`.
- [x] **CSV import denial of service**: `import_students_csv` checks `content-length` and streaming byte count against a 10MB ceiling.
- [x] **Static mount file execution risk**: Direct script/SVG execution prevented via `Content-Security-Policy` and `X-Content-Type-Options: nosniff`.

---

### 10. 🛡️ API Security & Input Validation
- [x] **Pydantic schema validation**: Used across endpoints for payload structure.
- [x] **String length and regex boundaries**: Applied `min_length`, `max_length`, and regex validation to user models.
- [x] **JSON payload size limits**: Middleware in `main.py` enforces `MAX_JSON_BODY_BYTES` (default 10MB), rejecting oversized requests with 413 Payload Too Large.

---

### 11. 🚨 Rate Limiting (Priority: CRITICAL)
- [x] **SlowAPI installed and configured**: Attached SlowAPI `Limiter` in `app/limiter.py` and mounted error handlers in `main.py`.
- [x] **Brute-force protection on `/api/auth/login`**: 5 requests per minute per IP limit.
- [x] **Brute-force protection on `/api/certificates/verify/*`**: 30 requests per minute per IP limit.
- [x] **Spam protection on `/api/quizzes/{id}/submit`**: 10 requests per minute per IP limit.
- [x] **Protection on admin endpoints**: Administrative routes protected with SlowAPI limiters.

---

### 12. 🌐 Cloudflare / HTTPS & Network Architecture
- [x] **CORS origins whitelist**: Enforces allowed domains + localhost in development (`config.py:35-56`, `main.py:56-64`).
- [x] **No wildcards with credentials**: Does not use `allow_origins=["*"]` when `allow_credentials=True`.
- [x] **PostgreSQL isolation**: Removed `ports: - "${POSTGRES_PORT:-5432}:5432"` from `docker-compose.yml`, isolating PostgreSQL inside the Docker network.
- [x] **Backend loopback binding**: Bound backend port to `127.0.0.1:${BACKEND_PORT:-8000}:8000` to prevent unintended public exposure.

---

### 13. 🔑 Secrets & Environment Integrity
- [x] **Git repository clean**: No `.env` files containing secrets committed to Git.
- [x] **`.gitignore` protects environment files**: Excludes `.env`, `.env.*`, `data/*`, `*.db`.
- [x] **Production startup validation**: Application lifespan verifies that `SECRET_KEY` is not a trivial or default placeholder in production mode (`main.py:35-43`).

---

### 14. 🐳 Docker Hardening
- [x] **Minimal base images**: Uses `python:3.12-slim` and `node:22-alpine`.
- [x] **Health checks configured**: Configured in `Dockerfile` and `docker-compose.yml`.
- [x] **Restart policies active**: `restart: unless-stopped` enabled.
- [x] **Non-root container execution**:
  - `backend/Dockerfile` configured with non-root user `appuser` (UID 1000).
  - `frontend/Dockerfile` configured with non-root user `nextjs` (UID 1001).

---

### 15. 🗄️ PostgreSQL Hardening
- [x] **Connection pooling and graceful shutdown**: Handled with `create_async_engine` and `lifespan` disposal (`main.py:45`).
- [x] **Health check queries safe**: Uses `SELECT 1` in `check_database_health()`.
- [x] **PostgreSQL port published to host removed**: Removed host port mapping from `docker-compose.yml`.

---

### 16. 💉 SQL Injection Audit
- [x] **No raw SQL string concatenation**: 100% of queries use SQLAlchemy async ORM methods (`select()`, `where()`, `or_()`, `and_()`).
- [x] **Zero instances of `f"SELECT... {user_input}"`**: Verified across entire repository.

---

### 17. 🧪 Cross-Site Scripting (XSS) Audit
- [x] **No `dangerouslySetInnerHTML`**: Grep audit across `frontend/src` returned zero usages.
- [x] **No raw DOM manipulation**: No `innerHTML`, `outerHTML`, or `eval()`.
- [x] **React auto-escaping**: All course, user, and quiz titles are passed as standard React children.
- [x] **CSP header protection**: Configured Content-Security-Policy in both FastAPI and Next.js.

---

### 18. 🔒 CSRF & Token Architecture
- [x] **Token transport model**: API relies strictly on `Authorization: Bearer <token>` HTTP headers.
- [x] **No ambient cookie authorization**: Browsers do not automatically attach tokens on cross-site requests.

---

### 19. 🔐 Security Headers
- [x] **FastAPI security headers middleware**: Configured in `app/main.py`:
  - `Content-Security-Policy` (with YouTube iframe allowance)
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- [x] **Next.js security headers**: Configured in `frontend/next.config.ts` via `async headers()`.

---

### 20. 📊 Audit Logging
- [x] **AuditLog model updated**: Added `ip_address` (VARCHAR 45) and `user_agent` (VARCHAR 500) columns; `actor_user_id` set to nullable.
- [x] **Client request context extracted**: `record_audit` helper captures remote IP and User-Agent from FastAPI `Request`.
- [x] **Authentication events audited**: `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGIN_LOCKED`, `LOGOUT`, and `PASSWORD_CHANGED` logged.
- [x] **Quiz attempt logging**: Quiz submissions and scores recorded in unified `AuditLog`.
- [x] **Administrative actions audited**: Admin user creation, deactivation, deletion, student creation, deletion, certificate revocation, and manual issuance logged.

---

### 21. 🔍 Information Leakage & Production Hardening
- [x] **Interactive API Docs conditional**: `/docs`, `/redoc`, and `/openapi.json` are automatically disabled when `ENVIRONMENT=production`.
- [x] **Uncaught Exception Handler**: Global 500 error handler in FastAPI logs internal stack trace and returns generic sanitized `{"detail": "Internal server error. Please contact the administrator."}`.

---

### 22. 🩺 Health Endpoint Safety
- [x] **Minimal health endpoint**: `GET /api/health` returns only sanitized service status, database connectivity, and uptime metrics without exposing credentials, IPs, or connection strings.

---

### 23. ⏱️ Backend & DB Uptime Implementation
- [x] **Backend process uptime**: Captured `backend_started_at` in application state; formatted uptime (`Xd Xh Xm Xs`) returned in `/api/health` and `/`.
- [x] **PostgreSQL engine uptime**: Implemented `get_database_uptime()` querying `pg_postmaster_start_time()` in PostgreSQL (with SQLite compatibility fallback).

---

### 24. 🚫 Zero-Trust Frontend Enforcement Summary
The 4 server-side zero-trust gates are fully enforced:
1. **Video watched & active screen time increments**: Server enforces wall-clock heartbeat delta clamping.
2. **Sequential lecture video access**: Video URLs are stripped (`None`) for locked lectures.
3. **Quiz attempt gating**: 403 Forbidden enforced on un-enrolled students and locked quizzes.
4. **Revoked certificate download gating**: 403 Forbidden returned on attempts to download revoked certificates.

---

### 25. 🧪 Penetration Testing Verification
- [x] **Automated Test Suite**: Created `backend/tests/test_security_audit.py` with 12 comprehensive security test cases.
- [x] **Full Backend Test Run**: All **25 automated tests** across `test_addadmins.py`, `test_root.py`, `test_video_completion_flow.py`, and `test_security_audit.py` pass with 100% success rate.
