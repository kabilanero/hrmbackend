# HRM Backend

NestJS 11 · Prisma 6.19.3 (`prisma` and `@prisma/client` pinned to the **same exact version**) · Supabase (Postgres, Auth, Storage) · Swagger.

All endpoints live under the global route **`/api/v1`** (global prefix `api` + URI version `v1`).
Swagger UI: **`/api/docs`** · OpenAPI JSON: `/api/docs-json`.

## Quick start

```bash
cp .env.example .env            # fill in Supabase values
npm install
npm run prisma:generate   # (also runs automatically before start/build/test)
npm run prisma:migrate:deploy   # applies prisma/migrations (use prisma:migrate:dev while developing)
SEED_ADMIN_EMAIL=admin@company.com SEED_ADMIN_PASSWORD='Str0ngPassw0rd' npm run prisma:seed
npm run start:dev               # http://localhost:3000/api/docs
```

Supabase values: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API);
`DATABASE_URL` = pooled connection (port 6543), `DIRECT_URL` = direct connection (port 5432) from Project Settings → Database.
`SUPABASE_JWT_SECRET` is optional: with it tokens are verified locally; without it Supabase Auth verifies them.

In Swagger: call `POST /auth/login`, click **Authorize**, paste `accessToken`.

## Architecture

```
src/
  main.ts / setup-app.ts     bootstrap: prefix, versioning, helmet, CORS, compression, Swagger
  config/                    typed configuration + fail-fast env validation
  common/                    cross-cutting, framework-level code
    base/                    BaseCrudService + createCrudController() factory (master data in ~30 lines)
    decorators/ guards/      @Public, @Roles, @CurrentUser; JwtAuthGuard, RolesGuard (global)
    filters/ interceptors/   one error contract, one success envelope
    dto/ utils/              pagination, sort whitelist, search, date/timezone helpers
  infrastructure/
    prisma/                  PrismaService on the `pg` driver adapter (Rust-free client)
    supabase/                admin/anon clients, token verification, Storage service
  modules/                   feature modules (controller -> service -> Prisma)
    auth  users  employees  leaves  attendance  dashboard  health
    departments designations branches work-shifts leave-types holidays blood-groups
prisma/  schema.prisma  migrations/  seed.ts
test/    e2e suite (fake Supabase, real Postgres)
```

Key decisions
- **Layering**: controllers are thin and validate/document only; business rules live in services; infrastructure is injected globally.
- **Security by default**: every route needs a Supabase JWT unless `@Public()`; roles via `@Roles()`; guard order is throttle → authenticate → authorise. Row-level rules (self / manager-of / HR) are centralised in `EmployeeAccessService`.
- **Supabase**: Auth owns credentials; `user_accounts.id` equals `auth.users.id` and stores role and employee link. Profile images go to a private Storage bucket and are served via signed URLs.
- **Uniform contracts**: success `{ success, statusCode, data, meta?, path, timestamp }`; error `{ success:false, statusCode, error, message, errors?, path, timestamp }`. Prisma errors map to 409 / 404 / 400.
- **Pagination**: `?page=1&size=20&sort=field:asc&search=...`; sortable fields are whitelisted.
- The legacy frontend header `token: Bearer …` is still accepted next to `Authorization`.

## Roles
`ADMIN` everything · `HR` employees/leave/attendance management · `MANAGER` own team, approves team leave · `EMPLOYEE` self-service.

## Business rules implemented
- Leave: working days exclude Sat/Sun and active national holidays; overlapping pending/approved leave is rejected; yearly entitlement per leave type is enforced; approval by HR/Admin or the direct manager, never by the applicant (except Admin).
- Attendance: one record per employee per day in `APP_TIMEZONE`; worked minutes computed on punch-out; half-day detected from the work shift; monthly view derives holiday / leave / weekend / absent.
- Employees are deactivated, never hard-deleted; their login is disabled with them.

## Frontend migration (legacy path → new)
| Legacy | New |
|---|---|
| `POST /users/authenticate` | `POST /api/v1/auth/login` |
| `/admin/metadata/hr/department/{create,update,get,get-all,get-page,delete}` | `POST/PATCH/GET/DELETE /api/v1/departments`, `GET /departments/all`, `GET /departments?page&size` |
| same pattern for designation, work shift, leave type, blood group, national holidays | `/designations`, `/work-shifts`, `/leave-types`, `/blood-groups`, `/holidays` |
| `/hr/employeedetails/*` | `/api/v1/employees`, `/employees/me`, `/employees/:id/addresses`, `/bank-accounts`, `/profile-image` |
| `/hr/leave/applyleave` | `/api/v1/leaves` (+ `/decision`, `/cancel`, `/revoke`, `/balance`) |
| `/hr/attendancedetails`, biometric daily | `/api/v1/attendance` (`punch-in`, `punch-out`, `monthly`) |
| `/reports/employee/dashboard/*` | `/api/v1/dashboard/summary` |

## Not yet ported
The frontend also calls ~600 endpoints for CRM, billing, bug tracking, support tickets, products and app-health. They follow the same `create/update/get/get-all/get-page/delete` shape, so each is a Prisma model plus a ~30-line module using `createCrudController`. Multi-tenancy (`tenantId` header) is not implemented; this is a single Supabase project.

## Scripts
`start:dev` · `build` · `start:prod` · `test` (unit) · `test:e2e` (needs a migrated Postgres in `DATABASE_URL`) · `prisma:*`
