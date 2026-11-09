import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { SupabaseStorageService } from '../src/infrastructure/supabase/supabase-storage.service';
import { SupabaseService } from '../src/infrastructure/supabase/supabase.service';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';
import { FakeStorageService, FakeSupabaseService } from './fakes';
import request from 'supertest';

const API = '/api/v1';
const RUN = Date.now().toString(36);

describe('HRM API (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const supa = new FakeSupabaseService();
  let http: ReturnType<typeof request>;

  let adminToken: string;
  let employeeToken: string;
  let managerToken: string;
  const ids: Record<string, string> = {};

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function makeAccount(role: string, email: string, employeeId?: string) {
    const { id, token } = supa.addUser(email);
    const r = await prisma.role.findUniqueOrThrow({ where: { name: role } });
    await prisma.userAccount.create({ data: { id, email, roleId: r.id, employeeId } });
    return token;
  }

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SupabaseService).useValue(supa)
      .overrideProvider(SupabaseStorageService).useValue(new FakeStorageService())
      .compile();
    app = mod.createNestApplication<NestExpressApplication>();
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    http = request(app.getHttpServer());

    for (const name of ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE']) {
      await prisma.role.upsert({ where: { name }, update: {}, create: { name, isSystem: true } });
    }
    adminToken = await makeAccount('ADMIN', `admin-${RUN}@t.io`);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('platform', () => {
    it('serves under /api/v1 only', async () => {
      await http.get(`${API}/departments`).set(auth(adminToken)).expect(200);
      await http.get('/api/departments').set(auth(adminToken)).expect(404);
      await http.get('/api/v2/departments').set(auth(adminToken)).expect(404);
    });

    it('requires authentication, health is public & un-enveloped', async () => {
      await http.get(`${API}/employees`).expect(401);
      await http.get(`${API}/employees`).set(auth('garbage')).expect(401);
      const h = await http.get(`${API}/health/ready`).expect(200);
      expect(h.body.status).toBe('ok');
      expect(h.body.success).toBeUndefined();
    });

    it('exposes Swagger UI and an OpenAPI doc with versioned paths', async () => {
      await http.get('/api/docs').expect(200);
      const doc = await http.get('/api/docs-json').expect(200);
      const paths = Object.keys(doc.body.paths);
      expect(paths).toEqual(expect.arrayContaining([`${API}/employees`, `${API}/auth/login`, `${API}/leaves`]));
      expect(doc.body.components.securitySchemes['access-token']).toBeDefined();
    });

    it('wraps responses and errors in the standard envelope', async () => {
      const ok = await http.get(`${API}/departments`).set(auth(adminToken)).expect(200);
      expect(ok.body).toMatchObject({ success: true, statusCode: 200, data: expect.any(Array), meta: { page: 1 } });
      const bad = await http.post(`${API}/departments`).set(auth(adminToken)).send({ name: 'x', bogus: 1 }).expect(400);
      expect(bad.body).toMatchObject({ success: false, statusCode: 400, message: 'Validation failed' });
      expect(bad.body.errors.length).toBeGreaterThan(0);
    });
  });

  describe('auth', () => {
    it('registers an employee login, logs in, refreshes, reads /me, changes password', async () => {
      const email = `reg-${RUN}@t.io`;
      await http.post(`${API}/auth/register`).send({ email, password: 'Passw0rdOK' }).expect(400); // no employee yet
      const emp = await prisma.employee.create({
        data: { employeeCode: `REG-${RUN}`, employeeName: 'Reg User', emailId: email, dateOfJoining: new Date('2024-01-01') },
      });
      await http.post(`${API}/auth/register`).send({ email, password: 'weak' }).expect(400);
      const reg = await http.post(`${API}/auth/register`).send({ email, password: 'Passw0rdOK' }).expect(201);
      expect(reg.body.data).toMatchObject({ email, role: 'EMPLOYEE', employeeId: emp.id });
      await http.post(`${API}/auth/register`).send({ email, password: 'Passw0rdOK' }).expect(409);

      await http.post(`${API}/auth/login`).send({ email, password: 'nope' }).expect(401);
      const login = await http.post(`${API}/auth/login`).send({ email, password: 'Passw0rdOK' }).expect(200);
      const { accessToken, refreshToken } = login.body.data;
      expect(login.body.data.user.role).toBe('EMPLOYEE');

      await http.post(`${API}/auth/refresh`).send({ refreshToken }).expect(200);
      const me = await http.get(`${API}/auth/me`).set(auth(accessToken)).expect(200);
      expect(me.body.data.employee.employeeCode).toBe(`REG-${RUN}`);

      await http.post(`${API}/auth/change-password`).set(auth(accessToken))
        .send({ currentPassword: 'wrong', newPassword: 'N3wPassword1' }).expect(401);
      await http.post(`${API}/auth/change-password`).set(auth(accessToken))
        .send({ currentPassword: 'Passw0rdOK', newPassword: 'N3wPassword1' }).expect(200);
      await http.post(`${API}/auth/login`).send({ email, password: 'N3wPassword1' }).expect(200);
    });

    it('lets an admin manage users; non-admins are forbidden', async () => {
      const created = await http.post(`${API}/users`).set(auth(adminToken))
        .send({ email: `hr-${RUN}@t.io`, password: 'Passw0rdOK', role: 'HR' }).expect(201);
      expect(created.body.data.role).toBe('HR');
      await http.patch(`${API}/users/${created.body.data.id}`).set(auth(adminToken)).send({ isActive: false }).expect(200);
      // deactivated account can no longer use its token
      await http.get(`${API}/auth/me`).set(auth(`fake.${created.body.data.id}`)).expect(401);
      const emp = supa.addUser(`e-${RUN}@t.io`);
      const r = await prisma.role.findUniqueOrThrow({ where: { name: 'EMPLOYEE' } });
      await prisma.userAccount.create({ data: { id: emp.id, email: `e-${RUN}@t.io`, roleId: r.id } });
      await http.get(`${API}/users`).set(auth(emp.token)).expect(403);
      await http.delete(`${API}/users/${created.body.data.id}`).set(auth(adminToken)).expect(200);
    });
  });

  describe('master data', () => {
    it('departments: CRUD, duplicate -> 409, search + sort + paging', async () => {
      const name = `Eng-${RUN}`;
      const c = await http.post(`${API}/departments`).set(auth(adminToken)).send({ name }).expect(201);
      ids.dept = c.body.data.id;
      const dup = await http.post(`${API}/departments`).set(auth(adminToken)).send({ name }).expect(409);
      expect(dup.body.message).toMatch(/already exists/i);
      expect(dup.body.message).toContain('name');
      await http.post(`${API}/departments`).set(auth(adminToken)).send({ name: `Ops-${RUN}` }).expect(201);

      const list = await http.get(`${API}/departments?search=${RUN}&sort=name:desc&size=1`).set(auth(adminToken)).expect(200);
      expect(list.body.data).toHaveLength(1);
      expect(list.body.data[0].name).toBe(`Ops-${RUN}`);
      expect(list.body.meta).toMatchObject({ size: 1, totalItems: 2, totalPages: 2, hasNext: true });

      await http.get(`${API}/departments?sort=password:asc`).set(auth(adminToken)).expect(400);
      await http.patch(`${API}/departments/${ids.dept}`).set(auth(adminToken)).send({ description: 'Builders' }).expect(200);
      await http.get(`${API}/departments/not-a-uuid`).set(auth(adminToken)).expect(400);
      await http.get(`${API}/departments/00000000-0000-4000-8000-000000000000`).set(auth(adminToken)).expect(404);
    });

    it('other master modules work through the same factory', async () => {
      const des = await http.post(`${API}/designations`).set(auth(adminToken)).send({ name: `SE-${RUN}`, level: 3 }).expect(201);
      ids.desig = des.body.data.id;
      const br = await http.post(`${API}/branches`).set(auth(adminToken)).send({ code: `B-${RUN}`, name: 'HQ', phone: '+91 98765 43210' }).expect(201);
      ids.branch = br.body.data.id;
      await http.post(`${API}/branches`).set(auth(adminToken)).send({ code: `B2-${RUN}`, name: 'X', phone: 'abc' }).expect(400);
      const ws = await http.post(`${API}/work-shifts`).set(auth(adminToken))
        .send({ name: `Gen-${RUN}`, startTime: '09:00', endTime: '18:00', durationMin: 540 }).expect(201);
      ids.shift = ws.body.data.id;
      await http.post(`${API}/work-shifts`).set(auth(adminToken)).send({ name: 'bad', startTime: '25:00', endTime: '18:00', durationMin: 5 }).expect(400);
      const lt = await http.post(`${API}/leave-types`).set(auth(adminToken))
        .send({ code: `T${RUN}`.slice(0, 8), name: `Test Leave ${RUN}`, maxDaysYear: 5 }).expect(201);
      ids.leaveType = lt.body.data.id;
      const bg = await prisma.bloodGroup.upsert({ where: { name: 'O+' }, update: {}, create: { name: 'O+' } });
      ids.blood = bg.id;
      const h = await http.post(`${API}/holidays`).set(auth(adminToken)).send({ name: `Fest-${RUN}`, date: '2031-01-14' }).expect(201);
      expect(h.body.data.year).toBe(2031);
      await http.get(`${API}/blood-groups/all`).set(auth(adminToken)).expect(200);
    });
  });

  describe('employees', () => {
    it('creates, reads, filters, updates and deactivates', async () => {
      const mk = (n: string, extra: object = {}) => ({
        employeeCode: `E-${n}-${RUN}`, employeeName: `Emp ${n}`, emailId: `emp-${n}-${RUN}@t.io`,
        dateOfJoining: '2024-03-01', ...extra,
      });
      const mgr = await http.post(`${API}/employees`).set(auth(adminToken)).send(mk('mgr', {
        departmentId: ids.dept, designationId: ids.desig, defaultBranchId: ids.branch, branchIds: [ids.branch],
        workShiftId: ids.shift, bloodGroupId: ids.blood, gender: 'FEMALE', basicPay: 90000.5,
      })).expect(201);
      ids.mgr = mgr.body.data.id;
      expect(mgr.body.data.branches).toHaveLength(1);
      expect(mgr.body.data.department.name).toBe(`Eng-${RUN}`);

      const e = await http.post(`${API}/employees`).set(auth(adminToken)).send(mk('one', {
        departmentId: ids.dept, reportsToId: ids.mgr, workShiftId: ids.shift,
      })).expect(201);
      ids.emp = e.body.data.id;
      await http.post(`${API}/employees`).set(auth(adminToken)).send(mk('one')).expect(409);
      await http.post(`${API}/employees`).set(auth(adminToken)).send(mk('bad', { dateOfResign: '2020-01-01' })).expect(400);
      await http.post(`${API}/employees`).set(auth(adminToken)).send(mk('bad2', { emailId: 'nope' })).expect(400);
      const fk = await http.post(`${API}/employees`).set(auth(adminToken))
        .send(mk('fk', { departmentId: '00000000-0000-4000-8000-000000000000' })).expect(400);
      expect(fk.body.message).toMatch(/does not exist/);

      const list = await http.get(`${API}/employees?departmentId=${ids.dept}&isActive=true&sort=employeeName:asc`).set(auth(adminToken)).expect(200);
      expect(list.body.meta.totalItems).toBe(2);
      const search = await http.get(`${API}/employees?search=emp-one-${RUN}`).set(auth(adminToken)).expect(200);
      expect(search.body.data).toHaveLength(1);

      await http.patch(`${API}/employees/${ids.emp}`).set(auth(adminToken)).send({ reportsToId: ids.emp }).expect(400);
      const up = await http.patch(`${API}/employees/${ids.emp}`).set(auth(adminToken)).send({ highestQualification: 'MBA', branchIds: [ids.branch] }).expect(200);
      expect(up.body.data.branches).toHaveLength(1);

      const rep = await http.get(`${API}/employees/${ids.mgr}/reportees`).set(auth(adminToken)).expect(200);
      expect(rep.body.data).toHaveLength(1);
    });

    it('enforces row-level access for employee and manager roles', async () => {
      employeeToken = await makeAccount('EMPLOYEE', `acc-emp-${RUN}@t.io`, ids.emp);
      managerToken = await makeAccount('MANAGER', `acc-mgr-${RUN}@t.io`, ids.mgr);

      await http.get(`${API}/employees`).set(auth(employeeToken)).expect(403);
      await http.get(`${API}/employees/me`).set(auth(employeeToken)).expect(200);
      await http.get(`${API}/employees/${ids.emp}`).set(auth(employeeToken)).expect(200);
      await http.get(`${API}/employees/${ids.mgr}`).set(auth(employeeToken)).expect(403);
      await http.post(`${API}/employees`).set(auth(employeeToken)).send({}).expect(403);

      const team = await http.get(`${API}/employees`).set(auth(managerToken)).expect(200);
      expect(team.body.data.map((x: any) => x.id)).toEqual([ids.emp]);
      await http.get(`${API}/employees/${ids.emp}`).set(auth(managerToken)).expect(200);
    });

    it('manages addresses and bank accounts (self or HR only for finance data)', async () => {
      const a = await http.post(`${API}/employees/${ids.emp}/addresses`).set(auth(employeeToken))
        .send({ addressLine: '12 MG Road', city: 'Bengaluru', pincode: '560001' }).expect(201);
      await http.patch(`${API}/employees/${ids.emp}/addresses/${a.body.data.id}`).set(auth(employeeToken)).send({ city: 'Mysuru' }).expect(200);
      await http.post(`${API}/employees/${ids.mgr}/addresses`).set(auth(employeeToken)).send({ addressLine: 'x y z' }).expect(403);

      const b1 = await http.post(`${API}/employees/${ids.emp}/bank-accounts`).set(auth(employeeToken))
        .send({ bankName: 'HDFC', accountNumber: '501002345678', ifscCode: 'HDFC0001234', isPrimary: true }).expect(201);
      const b2 = await http.post(`${API}/employees/${ids.emp}/bank-accounts`).set(auth(employeeToken))
        .send({ bankName: 'SBI', accountNumber: '300200100999', ifscCode: 'SBIN0000123', isPrimary: true }).expect(201);
      const banks = await http.get(`${API}/employees/${ids.emp}/bank-accounts`).set(auth(employeeToken)).expect(200);
      expect(banks.body.data.filter((x: any) => x.isPrimary).map((x: any) => x.id)).toEqual([b2.body.data.id]);
      await http.post(`${API}/employees/${ids.emp}/bank-accounts`).set(auth(employeeToken)).send({ bankName: 'X', accountNumber: '123456', ifscCode: 'bad' }).expect(400);
      await http.get(`${API}/employees/${ids.emp}/bank-accounts`).set(auth(managerToken)).expect(403);
      expect(b1.body.data.id).toBeDefined();
    });

    it('uploads and signs a profile image', async () => {
      await http.post(`${API}/employees/${ids.emp}/profile-image`).set(auth(adminToken)).attach('file', Buffer.from('hi'), { filename: 'a.txt', contentType: 'text/plain' }).expect(400);
      const up = await http.post(`${API}/employees/${ids.emp}/profile-image`).set(auth(adminToken))
        .attach('file', Buffer.from([0xff, 0xd8, 0xff]), { filename: 'a.jpg', contentType: 'image/jpeg' }).expect(201);
      expect(up.body.data.url).toContain('https://signed.example/employees/');
      const got = await http.get(`${API}/employees/${ids.emp}/profile-image`).set(auth(employeeToken)).expect(200);
      expect(got.body.data.url).toBeTruthy();
    });
  });

  describe('leaves', () => {
    // 2031-01-13 (Mon) .. 2031-01-17 (Fri); Tue 14th is a holiday -> 4 working days
    let leaveId: string;

    it('applies with correct working-day math, blocks overlap and over-entitlement', async () => {
      const res = await http.post(`${API}/leaves`).set(auth(employeeToken))
        .send({ leaveTypeId: ids.leaveType, startDate: '2031-01-13', endDate: '2031-01-17', reason: 'Trip' }).expect(201);
      leaveId = res.body.data.id;
      expect(Number(res.body.data.noOfDays)).toBe(4);
      expect(res.body.data.status).toBe('PENDING');

      await http.post(`${API}/leaves`).set(auth(employeeToken))
        .send({ leaveTypeId: ids.leaveType, startDate: '2031-01-16', endDate: '2031-01-20', reason: 'Overlap' }).expect(409);
      await http.post(`${API}/leaves`).set(auth(employeeToken))
        .send({ leaveTypeId: ids.leaveType, startDate: '2031-02-03', endDate: '2031-02-07', reason: 'Too many' }).expect(400); // 4+5 > 5
      await http.post(`${API}/leaves`).set(auth(employeeToken))
        .send({ leaveTypeId: ids.leaveType, startDate: '2031-02-08', endDate: '2031-02-09', reason: 'Weekend' }).expect(400); // no working days
      await http.post(`${API}/leaves`).set(auth(employeeToken))
        .send({ leaveTypeId: ids.leaveType, startDate: '2031-02-10', endDate: '2031-02-09', reason: 'Reverse' }).expect(400);
    });

    it('enforces who can decide, then updates the balance', async () => {
      await http.patch(`${API}/leaves/${leaveId}/decision`).set(auth(employeeToken)).send({ status: 'APPROVED' }).expect(403);
      const other = await makeAccount('MANAGER', `other-mgr-${RUN}@t.io`, (await prisma.employee.create({
        data: { employeeCode: `OM-${RUN}`, employeeName: 'Other Mgr', emailId: `om-${RUN}@t.io`, dateOfJoining: new Date('2023-01-01') },
      })).id);
      await http.patch(`${API}/leaves/${leaveId}/decision`).set(auth(other)).send({ status: 'APPROVED' }).expect(403); // not their report
      const ok = await http.patch(`${API}/leaves/${leaveId}/decision`).set(auth(managerToken)).send({ status: 'APPROVED', remarks: 'Enjoy' }).expect(200);
      expect(ok.body.data).toMatchObject({ status: 'APPROVED', approverId: ids.mgr });
      await http.patch(`${API}/leaves/${leaveId}/decision`).set(auth(managerToken)).send({ status: 'REJECTED' }).expect(400);
      await http.patch(`${API}/leaves/${leaveId}/cancel`).set(auth(employeeToken)).expect(400);

      const bal = await http.get(`${API}/leaves/balance?year=2031`).set(auth(employeeToken)).expect(200);
      const row = bal.body.data.find((b: any) => b.leaveTypeId === ids.leaveType);
      expect(row).toMatchObject({ entitled: 5, used: 4, pending: 0, remaining: 1 });
    });

    it('scopes lists by role and supports cancel / revoke', async () => {
      const own = await http.get(`${API}/leaves?status=APPROVED`).set(auth(employeeToken)).expect(200);
      expect(own.body.data.every((l: any) => l.employee.id === ids.emp)).toBe(true);
      const p = await http.post(`${API}/leaves`).set(auth(employeeToken))
        .send({ leaveTypeId: ids.leaveType, startDate: '2031-03-03', endDate: '2031-03-03', reason: 'One day' }).expect(201);
      await http.patch(`${API}/leaves/${p.body.data.id}/cancel`).set(auth(employeeToken)).expect(200);
      await http.patch(`${API}/leaves/${leaveId}/revoke`).set(auth(adminToken)).expect(200);
      const bal = await http.get(`${API}/leaves/balance?year=2031&employeeId=${ids.emp}`).set(auth(managerToken)).expect(200);
      expect(bal.body.data.find((b: any) => b.leaveTypeId === ids.leaveType).used).toBe(0);
    });
  });

  describe('attendance', () => {
    it('punches in/out once per day and rejects repeats', async () => {
      await http.post(`${API}/attendance/punch-out`).set(auth(employeeToken)).expect(400);
      await http.post(`${API}/attendance/punch-in`).set(auth(employeeToken)).expect(201);
      await http.post(`${API}/attendance/punch-in`).set(auth(employeeToken)).expect(409);
      const out = await http.post(`${API}/attendance/punch-out`).set(auth(employeeToken)).expect(200);
      expect(out.body.data.punchOut).toBeTruthy();
      expect(out.body.data.status).toBe('HALF_DAY'); // 0 minutes worked < half of the 9h shift
      await http.post(`${API}/attendance/punch-out`).set(auth(employeeToken)).expect(409);
      const today = await http.get(`${API}/attendance/today`).set(auth(employeeToken)).expect(200);
      expect(today.body.data.punchIn).toBeTruthy();
    });

    it('lets HR correct a record and derives the monthly calendar', async () => {
      await http.put(`${API}/attendance`).set(auth(employeeToken)).send({}).expect(403);
      await http.put(`${API}/attendance`).set(auth(adminToken))
        .send({ employeeId: ids.emp, date: '2031-01-13', punchIn: '2031-01-13T09:00:00+05:30', punchOut: '2031-01-13T18:00:00+05:30', status: 'PRESENT' }).expect(200);
      await http.put(`${API}/attendance`).set(auth(adminToken))
        .send({ employeeId: ids.emp, date: '2031-01-13', punchIn: '2031-01-13T09:00:00+05:30', punchOut: '2031-01-13T08:00:00+05:30' }).expect(400);

      // leave was revoked earlier; re-apply + approve so ON_LEAVE shows up
      const l = await http.post(`${API}/leaves`).set(auth(employeeToken))
        .send({ leaveTypeId: ids.leaveType, startDate: '2031-01-15', endDate: '2031-01-15', reason: 'Day off' }).expect(201);
      await http.patch(`${API}/leaves/${l.body.data.id}/decision`).set(auth(adminToken)).send({ status: 'APPROVED' }).expect(200);

      const m = await http.get(`${API}/attendance/monthly?year=2031&month=1`).set(auth(employeeToken)).expect(200);
      const day = (d: string) => m.body.data.days.find((x: any) => x.date === d);
      expect(day('2031-01-13')).toMatchObject({ status: 'PRESENT', workedMinutes: 540 });
      expect(day('2031-01-14')).toMatchObject({ status: 'HOLIDAY', holiday: `Fest-${RUN}` });
      expect(day('2031-01-15').status).toBe('ON_LEAVE');
      expect(day('2031-01-18').status).toBe('WEEK_OFF');
      expect(day('2031-01-16').status).toBeNull(); // future working day
      expect(m.body.data.summary).toMatchObject({ present: 1, holidays: 1, onLeave: 1 });

      const list = await http.get(`${API}/attendance?employeeId=${ids.emp}&from=2031-01-01&to=2031-01-31`).set(auth(managerToken)).expect(200);
      expect(list.body.data).toHaveLength(1);
      await http.get(`${API}/attendance?employeeId=${ids.mgr}`).set(auth(employeeToken)).expect(403);
    });
  });

  describe('dashboard', () => {
    it('is restricted to HR/Admin and returns aggregates', async () => {
      await http.get(`${API}/dashboard/summary`).set(auth(employeeToken)).expect(403);
      const res = await http.get(`${API}/dashboard/summary`).set(auth(adminToken)).expect(200);
      expect(res.body.data.employees.active).toBeGreaterThanOrEqual(2);
      expect(res.body.data.byDepartment.length).toBeGreaterThan(0);
    });
  });

  describe('referential integrity', () => {
    it('deactivates employees, disabling their login; blocks deleting referenced master data', async () => {
      await http.delete(`${API}/departments/${ids.dept}`).set(auth(adminToken)).expect(200); // SetNull relation allows delete
      await http.delete(`${API}/employees/${ids.emp}`).set(auth(adminToken)).expect(200);
      await http.get(`${API}/employees/me`).set(auth(employeeToken)).expect(401);
      await http.delete(`${API}/leave-types/${ids.leaveType}`).set(auth(adminToken)).expect(409); // has leave history
    });
  });
});
