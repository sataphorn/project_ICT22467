/* =========================================================================
   FITCLUB PRO — Relational Prototype Engine (script.js)
   Strict Consistency: 7 Tables · 35 Columns · ER Diagram & Data Dictionary
   ========================================================================= */

(function () {
  "use strict";

  const STORAGE_KEY = "fitclub_pro_db_v35";

  /* -----------------------------------------------------------------------
     Date Helpers
     ----------------------------------------------------------------------- */
  function getTodayStr() {
    return formatDateISO(new Date());
  }

  function formatDateISO(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function formatDateTimeNow() {
    const d = new Date();
    const datePart = formatDateISO(d);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${datePart} ${hh}:${mm}:${ss}`;
  }

  function addDaysStr(baseStr, days) {
    const [y, m, d] = baseStr.split("-").map(Number);
    return formatDateISO(new Date(y, m - 1, d + days));
  }

  function addMonthsStr(baseStr, months) {
    const [y, m, d] = baseStr.split("-").map(Number);
    return formatDateISO(new Date(y, m - 1 + Number(months), d));
  }

  function getMondayOfWeek(baseStr, weekOffset = 0) {
    const [y, m, d] = baseStr.split("-").map(Number);
    const dt = new Date(y, m - 1, d + weekOffset * 7);
    const day = dt.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    dt.setDate(dt.getDate() + diff);
    return formatDateISO(dt);
  }

  function formatThaiDate(isoStr) {
    if (!isoStr) return "-";
    const [y, m, d] = isoStr.split("-");
    const months = [
      "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
      "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
    ];
    return `${Number(d)} ${months[Number(m) - 1]} ${Number(y) + 543}`;
  }

  /* -----------------------------------------------------------------------
     MySQL 8.0+ DDL Script (schema.sql) — 7 Tables · 35 Columns
     ----------------------------------------------------------------------- */
  const MYSQL_SCHEMA_SQL = `-- =========================================================================
-- FITCLUB PRO : ระบบสมาชิกฟิตเนสและจองคลาสออกกำลังกาย
-- MySQL 8.0+ Relational Schema (7 Tables · 35 Columns)
-- ตรงตาม ER Diagram & Data Dictionary 100%
-- =========================================================================

CREATE DATABASE IF NOT EXISTS fitclub_pro
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE fitclub_pro;

-- 1. ตาราง MEMBER (7 คอลัมน์) | Derived Attribute: age (ไม่เก็บในตาราง)
CREATE TABLE MEMBER (
  member_id   CHAR(6)      NOT NULL,
  first_name  VARCHAR(50)  NOT NULL,
  last_name   VARCHAR(50)  NOT NULL,
  phone       CHAR(10)     NOT NULL,
  email       VARCHAR(50)  NULL,
  birth_date  DATE         NOT NULL,
  join_date   DATE         NOT NULL,
  PRIMARY KEY (member_id),
  CONSTRAINT chk_member_id CHECK (member_id REGEXP '^M[0-9]{5}$'),
  CONSTRAINT chk_member_phone CHECK (phone REGEXP '^[0-9]{10}$')
) ENGINE=InnoDB;

-- 2. ตาราง MEMBERSHIP_PLAN (4 คอลัมน์)
CREATE TABLE MEMBERSHIP_PLAN (
  plan_id          CHAR(4)       NOT NULL,
  plan_name        VARCHAR(50)   NOT NULL,
  duration_months  INT           NOT NULL,
  price            DECIMAL(8,2)  NOT NULL,
  PRIMARY KEY (plan_id),
  CONSTRAINT chk_plan_id CHECK (plan_id REGEXP '^P[0-9]{3}$'),
  CONSTRAINT chk_plan_duration CHECK (duration_months > 0),
  CONSTRAINT chk_plan_price CHECK (price >= 0)
) ENGINE=InnoDB;

-- 3. ตาราง SUBSCRIPTION (4 คอลัมน์) — ตารางที่ได้จาก Relationship SUBSCRIBES (M:N)
--    Derived Attribute: subscription_status (ACTIVE เมื่อ MAX(end_date) >= CURDATE())
CREATE TABLE SUBSCRIPTION (
  member_id   CHAR(6)  NOT NULL,
  plan_id     CHAR(4)  NOT NULL,
  start_date  DATE     NOT NULL,
  end_date    DATE     NOT NULL,
  PRIMARY KEY (member_id, plan_id, start_date),
  CONSTRAINT fk_sub_member FOREIGN KEY (member_id)
    REFERENCES MEMBER(member_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_sub_plan FOREIGN KEY (plan_id)
    REFERENCES MEMBERSHIP_PLAN(plan_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_sub_dates CHECK (end_date >= start_date)
) ENGINE=InnoDB;

-- 4. ตาราง TRAINER (5 คอลัมน์)
CREATE TABLE TRAINER (
  trainer_id  CHAR(4)      NOT NULL,
  first_name  VARCHAR(50)  NOT NULL,
  last_name   VARCHAR(50)  NOT NULL,
  specialty   VARCHAR(50)  NOT NULL,
  phone       CHAR(10)     NOT NULL,
  PRIMARY KEY (trainer_id),
  CONSTRAINT chk_trainer_id CHECK (trainer_id REGEXP '^T[0-9]{3}$'),
  CONSTRAINT chk_trainer_phone CHECK (phone REGEXP '^[0-9]{10}$')
) ENGINE=InnoDB;

-- 5. ตาราง CLASS_SCHEDULE (8 คอลัมน์) | Derived Attribute: seats_remaining
CREATE TABLE CLASS_SCHEDULE (
  schedule_id  CHAR(6)      NOT NULL,
  trainer_id   CHAR(4)      NOT NULL,
  class_name   VARCHAR(50)  NOT NULL,
  class_date   DATE         NOT NULL,
  start_time   TIME         NOT NULL,
  end_time     TIME         NOT NULL,
  room         VARCHAR(50)  NOT NULL,
  max_seats    INT          NOT NULL,
  PRIMARY KEY (schedule_id),
  CONSTRAINT fk_sched_trainer FOREIGN KEY (trainer_id)
    REFERENCES TRAINER(trainer_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_schedule_id CHECK (schedule_id REGEXP '^S[0-9]{5}$'),
  CONSTRAINT chk_max_seats CHECK (max_seats > 0),
  CONSTRAINT chk_class_time CHECK (end_time > start_time)
) ENGINE=InnoDB;

-- 6. ตาราง CLASS_BOOKING (4 คอลัมน์) — ตารางที่ได้จาก Relationship BOOKS (M:N)
CREATE TABLE CLASS_BOOKING (
  member_id       CHAR(6)      NOT NULL,
  schedule_id     CHAR(6)      NOT NULL,
  booking_date    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  booking_status  VARCHAR(20)  NOT NULL DEFAULT 'BOOKED',
  PRIMARY KEY (member_id, schedule_id),
  CONSTRAINT fk_book_member FOREIGN KEY (member_id)
    REFERENCES MEMBER(member_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_book_schedule FOREIGN KEY (schedule_id)
    REFERENCES CLASS_SCHEDULE(schedule_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_booking_status CHECK (
    booking_status IN ('BOOKED', 'CANCELLED', 'ATTENDED', 'NO_SHOW')
  )
) ENGINE=InnoDB;

-- 7. ตาราง CHECK_IN (3 คอลัมน์) — Weak Entity ของ MEMBER (Relationship HAS_CHECK_IN)
CREATE TABLE CHECK_IN (
  member_id      CHAR(6)   NOT NULL,
  check_in_no    INT       NOT NULL,
  check_in_time  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (member_id, check_in_no),
  CONSTRAINT fk_checkin_member FOREIGN KEY (member_id)
    REFERENCES MEMBER(member_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_checkin_no CHECK (check_in_no >= 1)
) ENGINE=InnoDB;`;

  /* -----------------------------------------------------------------------
     35-Column Data Dictionary Metadata (Exact Match)
     ----------------------------------------------------------------------- */
  const DATA_DICTIONARY = [
    // 1. MEMBER (7)
    { table: "MEMBER", col: "member_id", type: "CHAR(6)", key: "PK", rule: "NOT NULL, รูปแบบ ^M\\d{5}$", desc: "รหัสประจำตัวสมาชิก" },
    { table: "MEMBER", col: "first_name", type: "VARCHAR(50)", key: "-", rule: "NOT NULL", desc: "ชื่อจริงของสมาชิก" },
    { table: "MEMBER", col: "last_name", type: "VARCHAR(50)", key: "-", rule: "NOT NULL", desc: "นามสกุลของสมาชิก" },
    { table: "MEMBER", col: "phone", type: "CHAR(10)", key: "-", rule: "NOT NULL, ตัวเลข 10 หลักไม่มีขีด", desc: "เบอร์โทรศัพท์ติดต่อ" },
    { table: "MEMBER", col: "email", type: "VARCHAR(50)", key: "-", rule: "NULL (ไม่บังคับ)", desc: "อีเมลของสมาชิก" },
    { table: "MEMBER", col: "birth_date", type: "DATE", key: "-", rule: "NOT NULL (ใช้คำนวณ Derived: age)", desc: "วันเดือนปีเกิด" },
    { table: "MEMBER", col: "join_date", type: "DATE", key: "-", rule: "NOT NULL", desc: "วันที่สมัครสมาชิกครั้งแรก" },
    // 2. MEMBERSHIP_PLAN (4)
    { table: "MEMBERSHIP_PLAN", col: "plan_id", type: "CHAR(4)", key: "PK", rule: "NOT NULL, รูปแบบ ^P\\d{3}$", desc: "รหัสแพ็กเกจสมาชิก" },
    { table: "MEMBERSHIP_PLAN", col: "plan_name", type: "VARCHAR(50)", key: "-", rule: "NOT NULL", desc: "ชื่อแพ็กเกจสมาชิก" },
    { table: "MEMBERSHIP_PLAN", col: "duration_months", type: "INT", key: "-", rule: "NOT NULL, > 0", desc: "ระยะเวลาแพ็กเกจ (เดือน)" },
    { table: "MEMBERSHIP_PLAN", col: "price", type: "DECIMAL(8,2)", key: "-", rule: "NOT NULL, >= 0", desc: "ราคาแพ็กเกจ (บาท)" },
    // 3. SUBSCRIPTION (4)
    { table: "SUBSCRIPTION", col: "member_id", type: "CHAR(6)", key: "PK, FK", rule: "FK -> MEMBER(member_id) ON DELETE CASCADE", desc: "รหัสสมาชิกที่สมัครแพ็กเกจ" },
    { table: "SUBSCRIPTION", col: "plan_id", type: "CHAR(4)", key: "PK, FK", rule: "FK -> MEMBERSHIP_PLAN(plan_id) ON DELETE RESTRICT", desc: "รหัสแพ็กเกจที่เลือกสมัคร" },
    { table: "SUBSCRIPTION", col: "start_date", type: "DATE", key: "PK", rule: "NOT NULL (PK ร่วม 3 คอลัมน์ ต่ออายุซ้ำได้)", desc: "วันที่เริ่มต้นรอบสมาชิก" },
    { table: "SUBSCRIPTION", col: "end_date", type: "DATE", key: "-", rule: "NOT NULL, start_date + duration_months เดือน", desc: "วันที่สิ้นสุดรอบสมาชิก (ใช้คำนวณ subscription_status)" },
    // 4. TRAINER (5)
    { table: "TRAINER", col: "trainer_id", type: "CHAR(4)", key: "PK", rule: "NOT NULL, รูปแบบ ^T\\d{3}$", desc: "รหัสประจำตัวเทรนเนอร์" },
    { table: "TRAINER", col: "first_name", type: "VARCHAR(50)", key: "-", rule: "NOT NULL", desc: "ชื่อจริงของเทรนเนอร์" },
    { table: "TRAINER", col: "last_name", type: "VARCHAR(50)", key: "-", rule: "NOT NULL", desc: "นามสกุลของเทรนเนอร์" },
    { table: "TRAINER", col: "specialty", type: "VARCHAR(50)", key: "-", rule: "NOT NULL", desc: "ความเชี่ยวชาญเฉพาะทาง" },
    { table: "TRAINER", col: "phone", type: "CHAR(10)", key: "-", rule: "NOT NULL, ตัวเลข 10 หลักไม่มีขีด", desc: "เบอร์โทรศัพท์ของเทรนเนอร์" },
    // 5. CLASS_SCHEDULE (8)
    { table: "CLASS_SCHEDULE", col: "schedule_id", type: "CHAR(6)", key: "PK", rule: "NOT NULL, รูปแบบ ^S\\d{5}$", desc: "รหัสรอบตารางคลาส" },
    { table: "CLASS_SCHEDULE", col: "trainer_id", type: "CHAR(4)", key: "FK", rule: "FK -> TRAINER(trainer_id) ON DELETE RESTRICT", desc: "รหัสเทรนเนอร์ผู้สอน" },
    { table: "CLASS_SCHEDULE", col: "class_name", type: "VARCHAR(50)", key: "-", rule: "NOT NULL", desc: "ชื่อคลาสออกกำลังกาย" },
    { table: "CLASS_SCHEDULE", col: "class_date", type: "DATE", key: "-", rule: "NOT NULL", desc: "วันที่เปิดสอนคลาส" },
    { table: "CLASS_SCHEDULE", col: "start_time", type: "TIME", key: "-", rule: "NOT NULL", desc: "เวลาเริ่มคลาส" },
    { table: "CLASS_SCHEDULE", col: "end_time", type: "TIME", key: "-", rule: "NOT NULL, > start_time", desc: "เวลาสิ้นสุดคลาส" },
    { table: "CLASS_SCHEDULE", col: "room", type: "VARCHAR(50)", key: "-", rule: "NOT NULL", desc: "ห้องหรือสตูดิโอที่จัดคลาส" },
    { table: "CLASS_SCHEDULE", col: "max_seats", type: "INT", key: "-", rule: "NOT NULL, > 0 (ใช้คำนวณ seats_remaining)", desc: "จำนวนที่นั่งสูงสุดต่อคลาส" },
    // 6. CLASS_BOOKING (4)
    { table: "CLASS_BOOKING", col: "member_id", type: "CHAR(6)", key: "PK, FK", rule: "FK -> MEMBER(member_id) ON DELETE CASCADE", desc: "รหัสสมาชิกผู้ทำการจอง" },
    { table: "CLASS_BOOKING", col: "schedule_id", type: "CHAR(6)", key: "PK, FK", rule: "FK -> CLASS_SCHEDULE(schedule_id) ON DELETE RESTRICT", desc: "รหัสรอบคลาสที่จอง" },
    { table: "CLASS_BOOKING", col: "booking_date", type: "DATETIME", key: "-", rule: "NOT NULL", desc: "วันและเวลาที่ทำรายการจอง" },
    { table: "CLASS_BOOKING", col: "booking_status", type: "VARCHAR(20)", key: "-", rule: "BOOKED | CANCELLED | ATTENDED | NO_SHOW", desc: "สถานะการจองและเช็คชื่อเข้าคลาส" },
    // 7. CHECK_IN (3)
    { table: "CHECK_IN", col: "member_id", type: "CHAR(6)", key: "PK, FK", rule: "FK -> MEMBER(member_id) ON DELETE CASCADE", desc: "รหัสสมาชิกเจ้าของประวัติเช็คอิน" },
    { table: "CHECK_IN", col: "check_in_no", type: "INT", key: "PK (Partial)", rule: "Weak Entity Partial Key: MAX(check_in_no)+1 ต่อสมาชิก", desc: "ลำดับครั้งที่เช็คอินของสมาชิกคนนั้น" },
    { table: "CHECK_IN", col: "check_in_time", type: "DATETIME", key: "-", rule: "NOT NULL (ตรวจสิทธิ์ตาม BR-8)", desc: "วันและเวลาที่สแกนเข้าประตูยิม" }
  ];

  /* -----------------------------------------------------------------------
     Initial Seed Dataset (Strictly 35 Columns across 7 Tables)
     ----------------------------------------------------------------------- */
  function createSeedData() {
    const today = getTodayStr();
    const mon = getMondayOfWeek(today, 0);

    return {
      MEMBER: [
        { member_id: "M00001", first_name: "ธนวัฒน์", last_name: "รัตนชัย", phone: "0812345678", email: "thanawat@fitclub.th", birth_date: "1996-05-14", join_date: addMonthsStr(today, -8) },
        { member_id: "M00002", first_name: "ณัฐธิดา", last_name: "วงศ์สุวรรณ", phone: "0898765432", email: "natthida@fitclub.th", birth_date: "1999-11-22", join_date: addMonthsStr(today, -3) },
        { member_id: "M00003", first_name: "ภูริพัฒน์", last_name: "เจริญกิจ", phone: "0823456789", email: null, birth_date: "1992-08-03", join_date: addMonthsStr(today, -6) },
        { member_id: "M00004", first_name: "พิมพ์ชนก", last_name: "ศิริวัฒน์", phone: "0865432109", email: "pimchanok@fitclub.th", birth_date: "2001-02-19", join_date: addMonthsStr(today, -1) },
        { member_id: "M00005", first_name: "ศุภกร", last_name: "กิตติไพศาล", phone: "0851122334", email: "supakorn@fitclub.th", birth_date: "1988-09-30", join_date: addMonthsStr(today, -12) }
      ],
      MEMBERSHIP_PLAN: [
        { plan_id: "P001", plan_name: "Monthly Starter (1 เดือน)", duration_months: 1, price: 1500.00 },
        { plan_id: "P002", plan_name: "Quarterly Pro (3 เดือน)", duration_months: 3, price: 3900.00 },
        { plan_id: "P003", plan_name: "Annual Elite (12 เดือน)", duration_months: 12, price: 12900.00 }
      ],
      SUBSCRIPTION: [
        { member_id: "M00001", plan_id: "P002", start_date: addMonthsStr(today, -8), end_date: addMonthsStr(today, -5) },
        { member_id: "M00001", plan_id: "P003", start_date: addMonthsStr(today, -5), end_date: addMonthsStr(today, 7) },
        { member_id: "M00002", plan_id: "P002", start_date: addMonthsStr(today, -1), end_date: addMonthsStr(today, 2) },
        { member_id: "M00003", plan_id: "P001", start_date: addMonthsStr(today, -2), end_date: addDaysStr(today, -10) },
        { member_id: "M00004", plan_id: "P001", start_date: addDaysStr(today, -12), end_date: addDaysStr(today, 18) },
        { member_id: "M00005", plan_id: "P002", start_date: addMonthsStr(today, -4), end_date: addDaysStr(today, -5) }
      ],
      TRAINER: [
        { trainer_id: "T001", first_name: "กฤตภาส", last_name: "พลังไชย", specialty: "HIIT & Functional", phone: "0911112222" },
        { trainer_id: "T002", first_name: "อัญชลี", last_name: "สุขสันต์", specialty: "Vinyasa Yoga & Pilates", phone: "0922223333" },
        { trainer_id: "T003", first_name: "ภาคิน", last_name: "แสนกล้า", specialty: "Muay Thai & Boxing", phone: "0933334444" }
      ],
      CLASS_SCHEDULE: [
        { schedule_id: "S00001", trainer_id: "T001", class_name: "HIIT Burn Express", class_date: addDaysStr(mon, 0), start_time: "09:00", end_time: "10:00", room: "Studio A", max_seats: 12 },
        { schedule_id: "S00002", trainer_id: "T002", class_name: "Morning Flow Yoga", class_date: addDaysStr(mon, 1), start_time: "10:30", end_time: "11:30", room: "Zen Room", max_seats: 15 },
        { schedule_id: "S00003", trainer_id: "T003", class_name: "Muay Thai Fit", class_date: addDaysStr(mon, 2), start_time: "17:30", end_time: "18:30", room: "Combat Zone", max_seats: 10 },
        { schedule_id: "S00004", trainer_id: "T001", class_name: "Core & Strength", class_date: addDaysStr(mon, 4), start_time: "18:00", end_time: "19:00", room: "Studio A", max_seats: 2 },
        { schedule_id: "S00005", trainer_id: "T002", class_name: "Core Pilates", class_date: addDaysStr(mon, 5), start_time: "14:00", end_time: "15:00", room: "Zen Room", max_seats: 12 },
        { schedule_id: "S00006", trainer_id: "T003", class_name: "Cardio Boxing", class_date: addDaysStr(mon, 8), start_time: "17:00", end_time: "18:00", room: "Combat Zone", max_seats: 10 }
      ],
      CLASS_BOOKING: [
        { member_id: "M00001", schedule_id: "S00001", booking_date: `${addDaysStr(today, -2)} 14:20:00`, booking_status: "BOOKED" },
        { member_id: "M00002", schedule_id: "S00001", booking_date: `${addDaysStr(today, -1)} 09:15:00`, booking_status: "ATTENDED" },
        { member_id: "M00004", schedule_id: "S00001", booking_date: `${addDaysStr(today, -1)} 11:05:00`, booking_status: "NO_SHOW" },
        { member_id: "M00001", schedule_id: "S00004", booking_date: `${today} 08:30:00`, booking_status: "BOOKED" },
        { member_id: "M00002", schedule_id: "S00004", booking_date: `${today} 08:45:00`, booking_status: "BOOKED" }
      ],
      CHECK_IN: [
        { member_id: "M00001", check_in_no: 1, check_in_time: `${addDaysStr(today, -3)} 08:12:10` },
        { member_id: "M00001", check_in_no: 2, check_in_time: `${addDaysStr(today, -1)} 17:40:05` },
        { member_id: "M00002", check_in_no: 1, check_in_time: `${today} 09:02:44` }
      ]
    };
  }

  /* -----------------------------------------------------------------------
     State & Persistence
     ----------------------------------------------------------------------- */
  let db = loadDatabase();
  const state = {
    role: getInitialRole(),
    dbTraceMode: false,
    selectedMemberId: db.MEMBER[0]?.member_id || "M00001",
    weekOffset: 0,
    classFilter: "ALL",
    selectedTrainerId: db.TRAINER[0]?.trainer_id || "T001",
    selectedScheduleId: db.CLASS_SCHEDULE[0]?.schedule_id || "S00001",
    adminTab: "overview",
    crudTable: "MEMBER",
    editContext: null,
    selectedPresetQuery: "q_active_members",
    concurrencyLogs: [
      { type: "sql", text: "-- พร้อมจำลองการทำงานของ SQL Transaction & Row-Level Locking (FOR UPDATE)" }
    ]
  };

  function getInitialRole() {
    const params = new URLSearchParams(window.location.search);
    const r = (params.get("role") || "").toLowerCase();
    if (["user", "trainer", "admin"].includes(r)) return r;
    return "home";
  }

  function loadDatabase() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.MEMBER && parsed.MEMBERSHIP_PLAN && parsed.SUBSCRIPTION) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Failed to load localStorage, resetting seed:", e);
    }
    const seed = createSeedData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }

  function saveDatabase() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }

  /* -----------------------------------------------------------------------
     Derived Attributes & Relational Business Rules
     ----------------------------------------------------------------------- */
  function calcAge(birthDateStr) {
    if (!birthDateStr) return 0;
    const today = new Date();
    const [y, m, d] = birthDateStr.split("-").map(Number);
    let age = today.getFullYear() - y;
    const mDiff = today.getMonth() + 1 - m;
    if (mDiff < 0 || (mDiff === 0 && today.getDate() < d)) {
      age--;
    }
    return Math.max(0, age);
  }

  function getMemberSubscriptionSummary(memberId) {
    const subs = db.SUBSCRIPTION.filter((s) => s.member_id === memberId);
    if (subs.length === 0) {
      return { status: "EXPIRED", latestSub: null, plan: null, maxEndDate: null, allSubs: [] };
    }
    const sortedByStart = [...subs].sort((a, b) => b.start_date.localeCompare(a.start_date));
    const latestSub = sortedByStart[0];
    const maxEndDate = subs.reduce((max, s) => (s.end_date > max ? s.end_date : max), subs[0].end_date);
    const today = getTodayStr();
    const status = maxEndDate >= today ? "ACTIVE" : "EXPIRED";
    const plan = db.MEMBERSHIP_PLAN.find((p) => p.plan_id === latestSub.plan_id) || null;
    return { status, latestSub, plan, maxEndDate, allSubs: sortedByStart };
  }

  function getSeatsRemaining(scheduleId) {
    const sched = db.CLASS_SCHEDULE.find((c) => c.schedule_id === scheduleId);
    if (!sched) return 0;
    const activeBookedCount = db.CLASS_BOOKING.filter(
      (b) => b.schedule_id === scheduleId && b.booking_status !== "CANCELLED"
    ).length;
    return Math.max(0, Number(sched.max_seats) - activeBookedCount);
  }

  function getNextCheckInNo(memberId) {
    const records = db.CHECK_IN.filter((c) => c.member_id === memberId);
    if (records.length === 0) return 1;
    return Math.max(...records.map((r) => Number(r.check_in_no))) + 1;
  }

  /* -----------------------------------------------------------------------
     Core Transactions & Actions
     ----------------------------------------------------------------------- */
  function performGateCheckIn(memberId) {
    const member = db.MEMBER.find((m) => m.member_id === memberId);
    if (!member) {
      return { ok: false, msg: `ไม่พบรหัสสมาชิก ${memberId} ในตาราง MEMBER` };
    }
    const subInfo = getMemberSubscriptionSummary(memberId);
    if (subInfo.status !== "ACTIVE") {
      return {
        ok: false,
        msg: `ปฏิเสธการเข้ายิม (BR-8): สมาชิก ${member.first_name} (${memberId}) มีสถานะ EXPIRED (หมดอายุวันที่ ${formatThaiDate(subInfo.maxEndDate)})`
      };
    }
    const nextNo = getNextCheckInNo(memberId);
    const now = formatDateTimeNow();
    db.CHECK_IN.push({
      member_id: memberId,
      check_in_no: nextNo,
      check_in_time: now
    });
    saveDatabase();
    return {
      ok: true,
      record: { member_id: memberId, check_in_no: nextNo, check_in_time: now },
      msg: `เช็คอินสำเร็จ! บันทึก CHECK_IN (${memberId}, ครั้งที่ #${nextNo}) เวลา ${now}`
    };
  }

  function performClassBooking(memberId, scheduleId) {
    const sched = db.CLASS_SCHEDULE.find((s) => s.schedule_id === scheduleId);
    if (!sched) return { ok: false, msg: "ไม่พบรอบคลาสที่เลือก" };

    const existing = db.CLASS_BOOKING.find(
      (b) => b.member_id === memberId && b.schedule_id === scheduleId
    );
    if (existing && existing.booking_status !== "CANCELLED") {
      return { ok: false, msg: "คุณได้จองคลาสรอบนี้ไว้แล้ว" };
    }

    const remaining = getSeatsRemaining(scheduleId);
    if (remaining <= 0) {
      return {
        ok: false,
        msg: `ไม่สามารถจองได้ (BR-1): คลาส ${sched.class_name} (${scheduleId}) ที่นั่งเต็มแล้ว (seats_remaining = 0)`
      };
    }

    const now = formatDateTimeNow();
    if (existing && existing.booking_status === "CANCELLED") {
      existing.booking_status = "BOOKED";
      existing.booking_date = now;
    } else {
      db.CLASS_BOOKING.push({
        member_id: memberId,
        schedule_id: scheduleId,
        booking_date: now,
        booking_status: "BOOKED"
      });
    }
    saveDatabase();
    return {
      ok: true,
      msg: `จองคลาส "${sched.class_name}" (${scheduleId}) สำเร็จ!`
    };
  }

  function performCancelBooking(memberId, scheduleId) {
    const existing = db.CLASS_BOOKING.find(
      (b) => b.member_id === memberId && b.schedule_id === scheduleId
    );
    if (!existing) return { ok: false, msg: "ไม่พบรายการจอง" };
    if (existing.booking_status === "ATTENDED" || existing.booking_status === "NO_SHOW") {
      return { ok: false, msg: "ไม่สามารถยกเลิกได้ เนื่องจากเทรนเนอร์บันทึกสถานะเข้าเรียนแล้ว" };
    }
    existing.booking_status = "CANCELLED";
    saveDatabase();
    return { ok: true, msg: `ยกเลิกการจองคลาส ${scheduleId} เรียบร้อยแล้ว (คืนที่นั่งว่าง +1)` };
  }

  function performRenewSubscription(memberId, planId, customStartDate) {
    const plan = db.MEMBERSHIP_PLAN.find((p) => p.plan_id === planId);
    if (!plan) return { ok: false, msg: "ไม่พบแพ็กเกจที่เลือก" };

    const startDate = customStartDate || getTodayStr();
    const dup = db.SUBSCRIPTION.find(
      (s) => s.member_id === memberId && s.plan_id === planId && s.start_date === startDate
    );
    if (dup) {
      return {
        ok: false,
        msg: `ซ้ำกับ Primary Key (member_id=${memberId}, plan_id=${planId}, start_date=${startDate}) กรุณาเลือกวันเริ่มต้นอื่น`
      };
    }
    const endDate = addMonthsStr(startDate, plan.duration_months);
    db.SUBSCRIPTION.push({
      member_id: memberId,
      plan_id: planId,
      start_date: startDate,
      end_date: endDate
    });
    saveDatabase();
    return {
      ok: true,
      msg: `ต่ออายุแพ็กเกจ ${plan.plan_name} สำเร็จ! ใช้งานได้ถึง ${formatThaiDate(endDate)}`
    };
  }

  /* -----------------------------------------------------------------------
     Toast Helper
     ----------------------------------------------------------------------- */
  function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");
    const el = document.createElement("div");
    el.className = `toast ${type === "error" ? "error" : type === "warn" ? "warn" : ""}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.remove();
    }, 3800);
  }

  /* -----------------------------------------------------------------------
     Navigation & Global Event Bindings
     ----------------------------------------------------------------------- */
  function setRole(role) {
    state.role = role;
    const url = new URL(window.location.href);
    if (role === "home") {
      url.searchParams.delete("role");
    } else {
      url.searchParams.set("role", role);
    }
    window.history.replaceState({}, "", url.toString());

    document.querySelectorAll(".nav-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.role === role);
    });
    render();
  }

  function setupGlobalEvents() {
    document.querySelectorAll(".nav-tab").forEach((btn) => {
      btn.addEventListener("click", () => setRole(btn.dataset.role));
    });

    document.getElementById("brandHome").addEventListener("click", () => setRole("home"));

    const btnDb = document.getElementById("btnToggleDbMode");
    btnDb.addEventListener("click", () => {
      state.dbTraceMode = !state.dbTraceMode;
      document.body.classList.toggle("db-trace-on", state.dbTraceMode);
      btnDb.classList.toggle("active", state.dbTraceMode);
      document.getElementById("dbModeLabel").textContent = state.dbTraceMode
        ? "ปิดโหมดชื่อคอลัมน์ DB"
        : "เปิดโหมดชื่อคอลัมน์ DB";
      showToast(
        state.dbTraceMode
          ? "เปิดโหมด ER Traceability: แสดงชื่อตารางและคอลัมน์กำกับทุกจุด"
          : "ปิดโหมดชื่อคอลัมน์ DB แล้ว"
      );
    });

    document.getElementById("btnResetData").addEventListener("click", () => {
      db = createSeedData();
      saveDatabase();
      state.selectedMemberId = db.MEMBER[0].member_id;
      state.selectedTrainerId = db.TRAINER[0].trainer_id;
      state.selectedScheduleId = db.CLASS_SCHEDULE[0].schedule_id;
      showToast("รีเซ็ตข้อมูลเริ่มต้นทั้ง 7 ตารางเรียบร้อยแล้ว");
      render();
    });

    // Schema Modal Controls
    const schemaModal = document.getElementById("schemaModal");
    document.getElementById("btnOpenSchema").addEventListener("click", () => {
      document.getElementById("sqlCodeDisplay").textContent = MYSQL_SCHEMA_SQL;
      schemaModal.classList.remove("hidden");
    });
    document.getElementById("btnCloseSchema").addEventListener("click", () => {
      schemaModal.classList.add("hidden");
    });
    schemaModal.addEventListener("click", (e) => {
      if (e.target === schemaModal) schemaModal.classList.add("hidden");
    });

    document.getElementById("btnCopySql").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(MYSQL_SCHEMA_SQL);
        showToast("คัดลอกสคริปต์ schema.sql ลงคลิปบอร์ดแล้ว!");
      } catch {
        showToast("ไม่สามารถคัดลอกอัตโนมัติได้ กรุณากดดาวน์โหลดไฟล์", "warn");
      }
    });

    document.getElementById("btnDownloadSql").addEventListener("click", () => {
      const blob = new Blob([MYSQL_SCHEMA_SQL], { type: "application/sql;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "schema.sql";
      a.click();
      URL.revokeObjectURL(a.href);
    });

    // Register Modal Controls
    const regModal = document.getElementById("registerModal");
    document.getElementById("btnCloseRegister").addEventListener("click", () => regModal.classList.add("hidden"));
    document.getElementById("btnCancelRegister").addEventListener("click", () => regModal.classList.add("hidden"));
    regModal.addEventListener("click", (e) => {
      if (e.target === regModal) regModal.classList.add("hidden");
    });

    document.getElementById("registerMemberForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const memberId = document.getElementById("regMemberId").value.trim().toUpperCase();
      const firstName = document.getElementById("regFirstName").value.trim();
      const lastName = document.getElementById("regLastName").value.trim();
      const phone = document.getElementById("regPhone").value.trim();
      const emailRaw = document.getElementById("regEmail").value.trim();
      const birthDate = document.getElementById("regBirthDate").value;
      const planId = document.getElementById("regPlanId").value;

      if (!/^M\d{5}$/.test(memberId)) {
        showToast("รหัสสมาชิกต้องอยู่ในรูปแบบ M00001 (^M\\d{5}$)", "error");
        return;
      }
      if (db.MEMBER.some((m) => m.member_id === memberId)) {
        showToast(`รหัสสมาชิก ${memberId} มีอยู่ในระบบแล้ว (Entity Integrity)`, "error");
        return;
      }
      if (!/^\d{10}$/.test(phone)) {
        showToast("เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลักไม่มีขีด", "error");
        return;
      }
      const plan = db.MEMBERSHIP_PLAN.find((p) => p.plan_id === planId);
      if (!plan) {
        showToast("กรุณาเลือกแพ็กเกจสมาชิกเริ่มต้น (BR-6)", "error");
        return;
      }

      const today = getTodayStr();
      const endDate = addMonthsStr(today, plan.duration_months);

      db.MEMBER.push({
        member_id: memberId,
        first_name: firstName,
        last_name: lastName,
        phone: phone,
        email: emailRaw === "" ? null : emailRaw,
        birth_date: birthDate,
        join_date: today
      });
      db.SUBSCRIPTION.push({
        member_id: memberId,
        plan_id: plan.plan_id,
        start_date: today,
        end_date: endDate
      });
      saveDatabase();

      state.selectedMemberId = memberId;
      regModal.classList.add("hidden");
      showToast(`สมัครสมาชิก ${firstName} (${memberId}) พร้อมแพ็กเกจ ${plan.plan_name} สำเร็จ!`);
      render();
    });

    // Edit Modal Controls (CRUD UPDATE)
    const editModal = document.getElementById("editRecordModal");
    document.getElementById("btnCloseEdit").addEventListener("click", () => editModal.classList.add("hidden"));
    document.getElementById("btnCancelEdit").addEventListener("click", () => editModal.classList.add("hidden"));
    editModal.addEventListener("click", (e) => {
      if (e.target === editModal) editModal.classList.add("hidden");
    });

    document.getElementById("editRecordForm").addEventListener("submit", (e) => {
      e.preventDefault();
      if (!state.editContext) return;
      const { table, idx } = state.editContext;
      const target = db[table][idx];
      if (!target) return;

      const fd = new FormData(document.getElementById("editRecordForm"));
      const updates = {};
      for (const [k, v] of fd.entries()) {
        updates[k] = typeof v === "string" ? v.trim() : v;
      }

      if (table === "MEMBER") {
        if (!/^\d{10}$/.test(updates.phone)) return showToast("phone ต้องเป็นตัวเลข 10 หลัก", "error");
        target.first_name = updates.first_name;
        target.last_name = updates.last_name;
        target.phone = updates.phone;
        target.email = updates.email === "" ? null : updates.email;
        target.birth_date = updates.birth_date;
        target.join_date = updates.join_date;
      } else if (table === "MEMBERSHIP_PLAN") {
        const dur = Number(updates.duration_months);
        const prc = Number(updates.price);
        if (dur <= 0 || prc < 0) return showToast("duration_months ต้อง > 0 และ price >= 0", "error");
        target.plan_name = updates.plan_name;
        target.duration_months = dur;
        target.price = prc;
      } else if (table === "SUBSCRIPTION") {
        if (updates.end_date < target.start_date) return showToast("end_date ต้องไม่น้อยกว่า start_date", "error");
        target.end_date = updates.end_date;
      } else if (table === "TRAINER") {
        if (!/^\d{10}$/.test(updates.phone)) return showToast("phone ต้องเป็นตัวเลข 10 หลัก", "error");
        target.first_name = updates.first_name;
        target.last_name = updates.last_name;
        target.specialty = updates.specialty;
        target.phone = updates.phone;
      } else if (table === "CLASS_SCHEDULE") {
        const seats = Number(updates.max_seats);
        const activeBooked = db.CLASS_BOOKING.filter(
          (b) => b.schedule_id === target.schedule_id && b.booking_status !== "CANCELLED"
        ).length;
        if (seats < activeBooked) {
          return showToast(`max_seats ต้องไม่น้อยกว่าจำนวนผู้จองปัจจุบัน (${activeBooked} คน)`, "error");
        }
        if (updates.end_time <= updates.start_time) {
          return showToast("end_time ต้องมากกว่า start_time", "error");
        }
        target.trainer_id = updates.trainer_id;
        target.class_name = updates.class_name;
        target.class_date = updates.class_date;
        target.start_time = updates.start_time;
        target.end_time = updates.end_time;
        target.room = updates.room;
        target.max_seats = seats;
      } else if (table === "CLASS_BOOKING") {
        target.booking_date = updates.booking_date;
        target.booking_status = updates.booking_status;
      } else if (table === "CHECK_IN") {
        target.check_in_time = updates.check_in_time;
      }

      saveDatabase();
      editModal.classList.add("hidden");
      showToast(`อัปเดตข้อมูลในตาราง ${table} (UPDATE) สำเร็จ!`);
      render();
    });
  }

  function openRegisterModal() {
    const nextNum = db.MEMBER.length + 1;
    const suggestedId = `M${String(nextNum).padStart(5, "0")}`;
    document.getElementById("regMemberId").value = suggestedId;
    document.getElementById("regFirstName").value = "";
    document.getElementById("regLastName").value = "";
    document.getElementById("regPhone").value = "";
    document.getElementById("regEmail").value = "";
    document.getElementById("regBirthDate").value = "1998-01-15";

    const select = document.getElementById("regPlanId");
    select.innerHTML = db.MEMBERSHIP_PLAN.map(
      (p) => `<option value="${p.plan_id}">${p.plan_id} — ${p.plan_name} (${p.duration_months} เดือน · ฿${Number(p.price).toLocaleString()})</option>`
    ).join("");

    document.getElementById("registerModal").classList.remove("hidden");
  }

  function openEditModal(table, idx) {
    const row = db[table][idx];
    if (!row) return;
    state.editContext = { table, idx };

    document.getElementById("editModalTitle").textContent = `แก้ไขข้อมูลตาราง ${table} (SQL UPDATE)`;
    const tableCols = DATA_DICTIONARY.filter((d) => d.table === table);
    const fieldsContainer = document.getElementById("editFormFields");

    fieldsContainer.innerHTML = tableCols
      .map((c) => {
        const isPk = c.key.includes("PK");
        const val = row[c.col] ?? "";
        if (isPk) {
          return `
            <div class="form-group">
              <label>${c.col} <span class="badge badge-neutral">PK (ห้ามแก้ไข)</span></label>
              <input type="text" value="${val}" disabled />
            </div>`;
        }
        if (c.col === "trainer_id" && table === "CLASS_SCHEDULE") {
          return `
            <div class="form-group">
              <label>${c.col} (FK)</label>
              <select name="${c.col}" required>
                ${db.TRAINER.map(
                  (t) => `<option value="${t.trainer_id}" ${t.trainer_id === val ? "selected" : ""}>${t.trainer_id} — ${t.first_name} ${t.last_name}</option>`
                ).join("")}
              </select>
            </div>`;
        }
        if (c.col === "booking_status") {
          return `
            <div class="form-group">
              <label>${c.col}</label>
              <select name="${c.col}" required>
                ${["BOOKED", "CANCELLED", "ATTENDED", "NO_SHOW"]
                  .map((st) => `<option value="${st}" ${st === val ? "selected" : ""}>${st}</option>`)
                  .join("")}
              </select>
            </div>`;
        }
        let inputType = "text";
        if (c.type === "DATE") inputType = "date";
        else if (c.type === "TIME") inputType = "time";
        else if (c.type.startsWith("INT") || c.type.startsWith("DECIMAL")) inputType = "number";

        return `
          <div class="form-group">
            <label>${c.col} (${c.type})</label>
            <input type="${inputType}" name="${c.col}" value="${val}" ${c.col === "email" ? "" : "required"} />
          </div>`;
      })
      .join("");

    document.getElementById("editRecordModal").classList.remove("hidden");
  }

  /* -----------------------------------------------------------------------
     VIEW 1: Home / Role Launcher
     ----------------------------------------------------------------------- */
  function renderHomeView() {
    const activeMembers = db.MEMBER.filter((m) => getMemberSubscriptionSummary(m.member_id).status === "ACTIVE").length;
    const totalBookings = db.CLASS_BOOKING.filter((b) => b.booking_status !== "CANCELLED").length;

    return `
      <section class="hero-box">
        <div>
          <span class="hero-badge">RELATIONAL DATABASE SYSTEM · 7 TABLES · 35 ATTRIBUTES</span>
          <h1>FITCLUB PRO — ระบบสมาชิกฟิตเนส &amp; จองคลาสออกกำลังกาย</h1>
          <p>
            เว็บแอปพลิเคชันต้นแบบที่เชื่อมโยงทุกหน้าจอเข้ากับโครงสร้างฐานข้อมูลเชิงสัมพันธ์ตาม ER Diagram และ Data Dictionary
            ทั้ง 7 ตาราง 35 คอลัมน์ รองรับการทำงานครบ 3 บทบาท พร้อมโหมดตรวจสอบชื่อคอลัมน์ DB แบบเรียลไทม์
          </p>
        </div>
        <div class="hero-stats">
          <div class="hero-stat-item">
            <div class="hero-stat-val">${db.MEMBER.length}</div>
            <div class="hero-stat-lbl">สมาชิกทั้งหมด (Active ${activeMembers})</div>
          </div>
          <div class="hero-stat-item">
            <div class="hero-stat-val">${db.CLASS_SCHEDULE.length}</div>
            <div class="hero-stat-lbl">รอบคลาสเปิดสอน</div>
          </div>
          <div class="hero-stat-item">
            <div class="hero-stat-val">${totalBookings}</div>
            <div class="hero-stat-lbl">รายการจองคลาส</div>
          </div>
          <div class="hero-stat-item">
            <div class="hero-stat-val">${db.CHECK_IN.length}</div>
            <div class="hero-stat-lbl">ประวัติสแกนเข้ายิม</div>
          </div>
        </div>
      </section>

      <section class="role-grid">
        <div class="role-card">
          <div>
            <div class="role-icon user">🏃‍♂️</div>
            <h2>ฝั่งสมาชิกใช้งานจริง (Member Portal)</h2>
            <p>สำหรับสมาชิกฟิตเนสตรวจสอบสถานะบัตรสมาชิก ต่ออายุแพ็กเกจ สแกนเช็คอินเข้ายิม และจองคลาสประจำสัปดาห์</p>
            <ul class="role-features">
              <li>บัตรสมาชิกดิจิทัล คำนวณ <code>age</code> และ <code>subscription_status</code> อัตโนมัติ</li>
              <li>ต่ออายุแพ็กเกจด้วย Composite PK <code>(member_id, plan_id, start_date)</code></li>
              <li>สแกนเข้ายิมตามกฎ <strong>BR-8</strong> และนับลำดับ <code>check_in_no</code> ต่อสมาชิก</li>
              <li>ตารางคลาสประจำสัปดาห์ เลื่อนสัปดาห์ กรองชื่อคลาส และจอง/ยกเลิกเรียลไทม์</li>
            </ul>
          </div>
          <div class="role-card-actions">
            <button type="button" class="btn btn-primary" data-go-role="user">เข้าใช้งานฝั่งสมาชิก</button>
            <button type="button" class="btn btn-outline" data-copy-role="user" title="คัดลอกลิงก์ ?role=user">🔗 คัดลอกลิงก์</button>
          </div>
        </div>

        <div class="role-card">
          <div>
            <div class="role-icon trainer">🏋️‍♀️</div>
            <h2>ฝั่งเทรนเนอร์ผู้สอน (Trainer Portal)</h2>
            <p>สำหรับเทรนเนอร์ตรวจสอบรอบคลาสที่รับผิดชอบ ดูสรุปจำนวนผู้เข้าเรียน และเช็คชื่อสมาชิกในคลาส</p>
            <ul class="role-features">
              <li>เลือกโปรไฟล์เทรนเนอร์ (<code>TRAINER</code>) และรอบคลาสที่สอน (<code>CLASS_SCHEDULE</code>)</li>
              <li>การ์ดสรุป 4 ค่า: <code>max_seats</code>, <code>seats_remaining</code>, <code>ATTENDED</code>, <code>NO_SHOW</code></li>
              <li>ตารางรายชื่อผู้จอง (<code>CLASS_BOOKING</code> JOIN <code>MEMBER</code>)</li>
              <li>ปุ่มเช็คชื่อเข้าเรียน <strong>[✓ มา (ATTENDED)]</strong> และ <strong>[✕ ไม่มา (NO_SHOW)]</strong></li>
            </ul>
          </div>
          <div class="role-card-actions">
            <button type="button" class="btn btn-dark" data-go-role="trainer">เข้าใช้งานฝั่งเทรนเนอร์</button>
            <button type="button" class="btn btn-outline" data-copy-role="trainer" title="คัดลอกลิงก์ ?role=trainer">🔗 คัดลอกลิงก์</button>
          </div>
        </div>

        <div class="role-card">
          <div>
            <div class="role-icon admin">🛠️</div>
            <h2>ฝั่งผู้ดูแลระบบ (Admin Back-Office)</h2>
            <p>สำหรับผู้ดูแลระบบและอาจารย์ตรวจโครงสร้าง ควบคุมจุดสแกนประตู จัดการข้อมูล 7 ตาราง และตรวจ ER Diagram</p>
            <ul class="role-features">
              <li>จุดสแกนหน้าประตู &amp; หน้าจำลอง SQL Concurrency (<code>FOR UPDATE</code>)</li>
              <li>ระบบ CRUD (เพิ่ม/แก้ไข/ลบ) ครบ <strong>7 ตาราง 35 คอลัมน์</strong> บังคับ <code>RESTRICT</code> &amp; <code>CASCADE</code></li>
              <li>ตัวทดสอบคำสั่ง <strong>SQL Query &amp; JOIN</strong> บนฐานข้อมูลจำลองแบบสด</li>
              <li>แผนภาพ <strong>ER Diagram (Chen Notation)</strong> และ <strong>Data Dictionary 35 คอลัมน์</strong></li>
            </ul>
          </div>
          <div class="role-card-actions">
            <button type="button" class="btn btn-indigo" data-go-role="admin">เข้าสู่ระบบหลังบ้าน</button>
            <button type="button" class="btn btn-outline" data-copy-role="admin" title="คัดลอกลิงก์ ?role=admin">🔗 คัดลอกลิงก์</button>
          </div>
        </div>
      </section>
    `;
  }

  /* -----------------------------------------------------------------------
     VIEW 2: Member Portal (User)
     ----------------------------------------------------------------------- */
  function renderUserView() {
    if (!db.MEMBER.some((m) => m.member_id === state.selectedMemberId)) {
      state.selectedMemberId = db.MEMBER[0]?.member_id || "";
    }
    const member = db.MEMBER.find((m) => m.member_id === state.selectedMemberId);
    if (!member) {
      return `<div class="card"><p>ไม่พบข้อมูลสมาชิกในระบบ กรุณากดสมัครสมาชิกใหม่</p></div>`;
    }

    const subSummary = getMemberSubscriptionSummary(member.member_id);
    const age = calcAge(member.birth_date);
    const checkIns = db.CHECK_IN
      .filter((c) => c.member_id === member.member_id)
      .sort((a, b) => b.check_in_no - a.check_in_no);

    const mondayStr = getMondayOfWeek(getTodayStr(), state.weekOffset);
    const sundayStr = addDaysStr(mondayStr, 6);
    const uniqueClassNames = [...new Set(db.CLASS_SCHEDULE.map((c) => c.class_name))];

    const weekSchedules = db.CLASS_SCHEDULE
      .filter((c) => c.class_date >= mondayStr && c.class_date <= sundayStr)
      .filter((c) => state.classFilter === "ALL" || c.class_name === state.classFilter)
      .sort((a, b) => `${a.class_date} ${a.start_time}`.localeCompare(`${b.class_date} ${b.start_time}`));

    const myBookings = db.CLASS_BOOKING
      .filter((b) => b.member_id === member.member_id)
      .sort((a, b) => b.booking_date.localeCompare(a.booking_date));

    return `
      <div class="member-top-bar">
        <div class="member-switcher">
          <label for="memberSelect"><strong>สลับบัญชีสมาชิกทดสอบ:</strong> <span class="db-badge pk">MEMBER.member_id</span></label>
          <select id="memberSelect">
            ${db.MEMBER.map((m) => {
              const st = getMemberSubscriptionSummary(m.member_id).status;
              return `<option value="${m.member_id}" ${m.member_id === member.member_id ? "selected" : ""}>
                ${m.member_id} — ${m.first_name} ${m.last_name} [${st}]
              </option>`;
            }).join("")}
          </select>
        </div>
        <button type="button" class="btn btn-primary" id="btnOpenRegisterModal">+ สมัครสมาชิกใหม่ (MEMBER + SUBSCRIPTION)</button>
      </div>

      <div class="member-profile-grid">
        <div class="digital-id-card">
          <div class="id-card-top">
            <div>
              <div class="id-member-code">MEMBER ID: ${member.member_id} <span class="db-badge pk">PK CHAR(6)</span></div>
              <div class="id-member-name">${member.first_name} ${member.last_name} <span class="db-badge">first_name, last_name</span></div>
            </div>
            <div>
              ${
                subSummary.status === "ACTIVE"
                  ? `<span class="badge badge-active">● ACTIVE <span class="db-badge derived">Derived: subscription_status</span></span>`
                  : `<span class="badge badge-expired">● EXPIRED <span class="db-badge derived">Derived: subscription_status</span></span>`
              }
            </div>
          </div>

          <div class="id-meta-grid">
            <div>
              <div class="id-meta-label">เบอร์โทรศัพท์ <span class="db-badge">phone</span></div>
              <div class="id-meta-value mono">${member.phone}</div>
            </div>
            <div>
              <div class="id-meta-label">อีเมล <span class="db-badge">email NULL</span></div>
              <div class="id-meta-value">${member.email || "<em>ไม่ระบุ (NULL)</em>"}</div>
            </div>
            <div>
              <div class="id-meta-label">วันเกิด / อายุ <span class="db-badge derived">Derived: age</span></div>
              <div class="id-meta-value">${formatThaiDate(member.birth_date)} (${age} ปี)</div>
            </div>
            <div>
              <div class="id-meta-label">วันที่สมัครครั้งแรก <span class="db-badge">join_date</span></div>
              <div class="id-meta-value">${formatThaiDate(member.join_date)}</div>
            </div>
          </div>

          <div class="id-sub-box">
            <div>
              <div style="font-size:0.78rem; color:#A7F3D0;">แพ็กเกจล่าสุด (เรียงตาม start_date ล่าสุด) <span class="db-badge">SUBSCRIPTION</span></div>
              <div style="font-weight:700; font-size:1rem;">
                ${subSummary.plan ? `${subSummary.plan.plan_id} : ${subSummary.plan.plan_name}` : "ไม่มีประวัติแพ็กเกจ"}
              </div>
              <div style="font-size:0.82rem; color:#D1FAE5;">
                เริ่ม ${formatThaiDate(subSummary.latestSub?.start_date)} — หมดอายุสูงสุด <strong>${formatThaiDate(subSummary.maxEndDate)}</strong>
              </div>
            </div>
            <button type="button" class="btn btn-primary" id="btnSelfCheckIn">
              📲 สแกนเช็คอินเข้ายิม (BR-8)
            </button>
          </div>

          <div class="renew-bar">
            <select id="renewPlanSelect" style="flex:1; min-width:190px;">
              ${db.MEMBERSHIP_PLAN.map(
                (p) => `<option value="${p.plan_id}">${p.plan_id} — ${p.plan_name} (฿${Number(p.price).toLocaleString()})</option>`
              ).join("")}
            </select>
            <input type="date" id="renewStartDate" value="${getTodayStr()}" title="SUBSCRIPTION.start_date (PK)" />
            <button type="button" class="btn btn-outline" id="btnRenewPlan">+ ต่ออายุแพ็กเกจ</button>
          </div>
        </div>

        <!-- Weak Entity CHECK_IN History -->
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">ประวัติสแกนเข้ายิม <span class="db-badge">Weak Entity: CHECK_IN</span></h3>
              <p class="card-subtitle">Composite PK: <code>(member_id, check_in_no)</code> นับลำดับต่อเฉพาะสมาชิกคนนี้</p>
            </div>
            <span class="badge badge-neutral">รวม ${checkIns.length} ครั้ง</span>
          </div>
          <div class="table-responsive" style="max-height: 270px; overflow-y: auto;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>ลำดับ <span class="db-badge pk">check_in_no</span></th>
                  <th>รหัสสมาชิก <span class="db-badge pk">member_id</span></th>
                  <th>วัน-เวลาที่สแกน <span class="db-badge">check_in_time</span></th>
                </tr>
              </thead>
              <tbody>
                ${
                  checkIns.length === 0
                    ? `<tr><td colspan="3" style="text-align:center; color:var(--text-muted);">ยังไม่มีประวัติการเช็คอิน</td></tr>`
                    : checkIns
                        .map(
                          (ci) => `
                        <tr>
                          <td><strong>#${ci.check_in_no}</strong></td>
                          <td class="mono">${ci.member_id}</td>
                          <td class="mono">${ci.check_in_time}</td>
                        </tr>`
                        )
                        .join("")
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Weekly Class Schedule -->
      <section class="card section-gap">
        <div class="card-header">
          <div>
            <h3 class="card-title">ตารางคลาสประจำสัปดาห์ <span class="db-badge">CLASS_SCHEDULE JOIN TRAINER</span></h3>
            <p class="card-subtitle">
              คำนวณที่นั่งว่าง <code>seats_remaining</code> แบบเรียลไทม์ (BR-1) · ไม่บล็อกสมาชิกหมดอายุในการจองคลาส (BR-8 ใช้เฉพาะเช็คอิน)
            </p>
          </div>
        </div>

        <div class="schedule-controls">
          <div class="week-nav-group">
            <button type="button" class="btn btn-outline btn-sm" id="btnPrevWeek">◀ สัปดาห์ก่อน</button>
            <button type="button" class="btn btn-outline btn-sm" id="btnThisWeek">สัปดาห์นี้</button>
            <button type="button" class="btn btn-outline btn-sm" id="btnNextWeek">สัปดาห์ถัดไป ▶</button>
            <span class="week-range-pill">📅 ${formatThaiDate(mondayStr)} – ${formatThaiDate(sundayStr)}</span>
          </div>

          <div style="display:flex; align-items:center; gap:8px;">
            <label for="classFilterSelect" style="font-size:0.86rem; font-weight:600;">กรองคลาส <span class="db-badge">class_name</span>:</label>
            <select id="classFilterSelect">
              <option value="ALL">ทุกประเภทคลาส (${db.CLASS_SCHEDULE.length})</option>
              ${uniqueClassNames
                .map(
                  (cn) => `<option value="${cn}" ${state.classFilter === cn ? "selected" : ""}>${cn}</option>`
                )
                .join("")}
            </select>
          </div>
        </div>

        ${
          weekSchedules.length === 0
            ? `<div style="padding:28px; text-align:center; background:var(--bg-subtle); border-radius:12px; color:var(--text-muted);">
                ไม่พบรอบคลาสในสัปดาห์นี้ตามเงื่อนไขที่เลือก ลองกดปุ่ม <strong>"สัปดาห์นี้"</strong> หรือ <strong>"สัปดาห์ถัดไป ▶"</strong>
              </div>`
            : `<div class="class-cards-grid">
                ${weekSchedules
                  .map((cls) => {
                    const trainer = db.TRAINER.find((t) => t.trainer_id === cls.trainer_id);
                    const remaining = getSeatsRemaining(cls.schedule_id);
                    const booking = db.CLASS_BOOKING.find(
                      (b) => b.member_id === member.member_id && b.schedule_id === cls.schedule_id
                    );
                    const isBooked = booking && booking.booking_status !== "CANCELLED";

                    let actionHtml = "";
                    if (isBooked) {
                      if (booking.booking_status === "BOOKED") {
                        actionHtml = `<button type="button" class="btn btn-outline-danger btn-sm" data-cancel-sched="${cls.schedule_id}">✕ ยกเลิกการจอง (${booking.booking_status})</button>`;
                      } else {
                        actionHtml = `<span class="badge badge-attended">สถานะ: ${booking.booking_status}</span>`;
                      }
                    } else if (remaining <= 0) {
                      actionHtml = `<button type="button" class="btn btn-outline btn-sm" disabled>ที่นั่งเต็ม (BR-1)</button>`;
                    } else {
                      actionHtml = `<button type="button" class="btn btn-primary btn-sm" data-book-sched="${cls.schedule_id}">
                        ${booking?.booking_status === "CANCELLED" ? "↻ จองคลาสนี้อีกครั้ง" : "+ จองคลาสนี้"}
                      </button>`;
                    }

                    return `
                      <div class="class-card">
                        <div>
                          <div class="class-card-top">
                            <div>
                              <span class="mono" style="font-size:0.78rem; color:var(--text-muted);">${cls.schedule_id} <span class="db-badge pk">schedule_id</span></span>
                              <div class="class-name">${cls.class_name} <span class="db-badge">class_name</span></div>
                            </div>
                            <span class="badge ${remaining > 0 ? "badge-active" : "badge-expired"}">
                              ว่าง ${remaining}/${cls.max_seats}
                            </span>
                          </div>
                          <div class="class-details" style="margin-top:10px;">
                            <div>📅 วันที่: <strong>${formatThaiDate(cls.class_date)}</strong> <span class="db-badge">class_date</span></div>
                            <div>⏰ เวลา: <strong>${cls.start_time} – ${cls.end_time}</strong> <span class="db-badge">start_time, end_time</span></div>
                            <div>📍 ห้อง: <strong>${cls.room}</strong> <span class="db-badge">room</span></div>
                            <div>🧑‍🏫 เทรนเนอร์: <strong>${trainer ? `${trainer.first_name} ${trainer.last_name}` : cls.trainer_id}</strong> <span class="db-badge fk">trainer_id</span></div>
                          </div>
                        </div>
                        <div>
                          <div class="seat-meter" style="margin-bottom:10px;">
                            <span>ที่นั่งคงเหลือ <span class="db-badge derived">Derived: seats_remaining</span></span>
                            <span>${remaining} / ${cls.max_seats} ที่นั่ง</span>
                          </div>
                          <div style="display:flex; justify-content:flex-end;">
                            ${actionHtml}
                          </div>
                        </div>
                      </div>
                    `;
                  })
                  .join("")}
              </div>`
        }
      </section>

      <!-- Subscription History & My Bookings -->
      <div class="member-profile-grid section-gap">
        <section class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">ประวัติแพ็กเกจสมาชิก <span class="db-badge">SUBSCRIPTION</span></h3>
              <p class="card-subtitle">Composite PK: <code>(member_id, plan_id, start_date)</code> รองรับการต่ออายุหลายรอบ</p>
            </div>
            <span class="badge badge-neutral">${subSummary.allSubs.length} รอบ</span>
          </div>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>รหัสแพ็กเกจ <span class="db-badge pk">plan_id</span></th>
                  <th>ชื่อแพ็กเกจ</th>
                  <th>วันเริ่มต้น <span class="db-badge pk">start_date</span></th>
                  <th>วันสิ้นสุด <span class="db-badge">end_date</span></th>
                </tr>
              </thead>
              <tbody>
                ${subSummary.allSubs
                  .map((s) => {
                    const pl = db.MEMBERSHIP_PLAN.find((p) => p.plan_id === s.plan_id);
                    return `
                      <tr>
                        <td class="mono"><strong>${s.plan_id}</strong></td>
                        <td>${pl ? pl.plan_name : "-"}</td>
                        <td class="mono">${s.start_date}</td>
                        <td class="mono">${s.end_date}</td>
                      </tr>`;
                  })
                  .join("")}
              </tbody>
            </table>
          </div>
        </section>

        <section class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">รายการจองคลาสของฉัน <span class="db-badge">CLASS_BOOKING</span></h3>
              <p class="card-subtitle">Composite PK: <code>(member_id, schedule_id)</code></p>
            </div>
            <span class="badge badge-neutral">${myBookings.length} รายการ</span>
          </div>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>คลาส <span class="db-badge pk">schedule_id</span></th>
                  <th>วันที่เรียน</th>
                  <th>สถานะ <span class="db-badge">booking_status</span></th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                ${
                  myBookings.length === 0
                    ? `<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">ยังไม่มีประวัติการจองคลาส</td></tr>`
                    : myBookings
                        .map((b) => {
                          const cls = db.CLASS_SCHEDULE.find((c) => c.schedule_id === b.schedule_id);
                          const statusBadge =
                            b.booking_status === "BOOKED"
                              ? `<span class="badge badge-booked">BOOKED</span>`
                              : b.booking_status === "ATTENDED"
                              ? `<span class="badge badge-attended">ATTENDED</span>`
                              : `<span class="badge badge-cancelled">${b.booking_status}</span>`;

                          return `
                            <tr>
                              <td><strong>${b.schedule_id}</strong> · ${cls ? cls.class_name : "-"}</td>
                              <td>${cls ? `${formatThaiDate(cls.class_date)} (${cls.start_time})` : "-"}</td>
                              <td>${statusBadge}</td>
                              <td>
                                ${
                                  b.booking_status === "BOOKED"
                                    ? `<button type="button" class="btn btn-outline-danger btn-sm" data-cancel-sched="${b.schedule_id}">ยกเลิก</button>`
                                    : `<span style="color:var(--text-light); font-size:0.82rem;">-</span>`
                                }
                              </td>
                            </tr>
                          `;
                        })
                        .join("")
                }
              </tbody>
            </table>
          </div>
        </section>
      </div>
    `;
  }

  /* -----------------------------------------------------------------------
     VIEW 3: Trainer Portal
     ----------------------------------------------------------------------- */
  function renderTrainerView() {
    if (!db.TRAINER.some((t) => t.trainer_id === state.selectedTrainerId)) {
      state.selectedTrainerId = db.TRAINER[0]?.trainer_id || "";
    }
    const trainer = db.TRAINER.find((t) => t.trainer_id === state.selectedTrainerId);
    const trainerClasses = db.CLASS_SCHEDULE.filter((c) => c.trainer_id === state.selectedTrainerId);

    if (!trainerClasses.some((c) => c.schedule_id === state.selectedScheduleId)) {
      state.selectedScheduleId = trainerClasses[0]?.schedule_id || "";
    }
    const currentClass = trainerClasses.find((c) => c.schedule_id === state.selectedScheduleId);

    const roster = currentClass
      ? db.CLASS_BOOKING.filter((b) => b.schedule_id === currentClass.schedule_id)
      : [];

    const maxSeats = currentClass ? Number(currentClass.max_seats) : 0;
    const seatsRemaining = currentClass ? getSeatsRemaining(currentClass.schedule_id) : 0;
    const attendedCount = roster.filter((r) => r.booking_status === "ATTENDED").length;
    const noShowCount = roster.filter((r) => r.booking_status === "NO_SHOW").length;

    return `
      <div class="member-top-bar">
        <div class="member-switcher">
          <label for="trainerSelect"><strong>เลือกเทรนเนอร์:</strong> <span class="db-badge pk">TRAINER.trainer_id</span></label>
          <select id="trainerSelect">
            ${db.TRAINER.map(
              (t) => `<option value="${t.trainer_id}" ${t.trainer_id === state.selectedTrainerId ? "selected" : ""}>
                ${t.trainer_id} — อ.${t.first_name} ${t.last_name} (${t.specialty})
              </option>`
            ).join("")}
          </select>

          <label for="trainerClassSelect" style="margin-left:8px;"><strong>เลือกรอบคลาสที่สอน:</strong> <span class="db-badge pk">CLASS_SCHEDULE.schedule_id</span></label>
          <select id="trainerClassSelect">
            ${
              trainerClasses.length === 0
                ? `<option value="">ไม่มีรอบคลาสที่รับผิดชอบ</option>`
                : trainerClasses
                    .map(
                      (c) => `<option value="${c.schedule_id}" ${c.schedule_id === state.selectedScheduleId ? "selected" : ""}>
                        ${c.schedule_id} — ${c.class_name} (${formatThaiDate(c.class_date)} ${c.start_time})
                      </option>`
                    )
                    .join("")
            }
          </select>
        </div>
        ${
          trainer
            ? `<span class="badge badge-booked">ความเชี่ยวชาญ: ${trainer.specialty} <span class="db-badge">specialty</span></span>`
            : ""
        }
      </div>

      ${
        !currentClass
          ? `<div class="card"><p>เทรนเนอร์ท่านนี้ยังไม่มีตารางสอนในระบบ</p></div>`
          : `
            <div class="kpi-grid">
              <div class="kpi-card">
                <div class="kpi-label">ที่นั่งทั้งหมดต่อคลาส <span class="db-badge">max_seats</span></div>
                <div class="kpi-value">${maxSeats}</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-label">ที่นั่งว่างคงเหลือ <span class="db-badge derived">Derived: seats_remaining</span></div>
                <div class="kpi-value" style="color:var(--sky);">${seatsRemaining}</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-label">เข้าเรียนแล้ว <span class="db-badge">ATTENDED</span></div>
                <div class="kpi-value" style="color:var(--emerald-dark);">${attendedCount}</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-label">ไม่มาตามนัด <span class="db-badge">NO_SHOW</span></div>
                <div class="kpi-value" style="color:var(--rose);">${noShowCount}</div>
              </div>
            </div>

            <div class="card">
              <div class="card-header">
                <div>
                  <h3 class="card-title">รายชื่อผู้จองและบันทึกการเข้าเรียน — ${currentClass.class_name} (${currentClass.schedule_id})</h3>
                  <p class="card-subtitle">
                    ห้อง <strong>${currentClass.room}</strong> · วันที่ ${formatThaiDate(currentClass.class_date)} เวลา ${currentClass.start_time}–${currentClass.end_time}
                  </p>
                </div>
              </div>

              <div class="table-responsive">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>รหัสสมาชิก <span class="db-badge pk">member_id</span></th>
                      <th>ชื่อ-นามสกุล <span class="db-badge">MEMBER</span></th>
                      <th>เบอร์โทร <span class="db-badge">phone</span></th>
                      <th>วันเวลาที่จอง <span class="db-badge">booking_date</span></th>
                      <th>สถานะการจอง <span class="db-badge">booking_status</span></th>
                      <th>เช็คชื่อเข้าคลาส</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${
                      roster.length === 0
                        ? `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">ยังไม่มีสมาชิกจองคลาสรอบนี้</td></tr>`
                        : roster
                            .map((r) => {
                              const m = db.MEMBER.find((mem) => mem.member_id === r.member_id);
                              const badge =
                                r.booking_status === "ATTENDED"
                                  ? `<span class="badge badge-attended">ATTENDED</span>`
                                  : r.booking_status === "NO_SHOW"
                                  ? `<span class="badge badge-noshow">NO_SHOW</span>`
                                  : r.booking_status === "CANCELLED"
                                  ? `<span class="badge badge-cancelled">CANCELLED</span>`
                                  : `<span class="badge badge-booked">BOOKED</span>`;

                              return `
                                <tr>
                                  <td class="mono"><strong>${r.member_id}</strong></td>
                                  <td>${m ? `${m.first_name} ${m.last_name}` : "-"}</td>
                                  <td class="mono">${m ? m.phone : "-"}</td>
                                  <td class="mono">${r.booking_date}</td>
                                  <td>${badge}</td>
                                  <td>
                                    ${
                                      r.booking_status === "CANCELLED"
                                        ? `<span style="color:var(--text-light); font-size:0.82rem;">ยกเลิกการจองแล้ว</span>`
                                        : `<div style="display:flex; flex-wrap:wrap; gap:6px;">
                                            <button type="button" class="btn btn-primary btn-sm" data-att-member="${r.member_id}" data-att-status="ATTENDED">✓ มา (ATTENDED)</button>
                                            <button type="button" class="btn btn-danger btn-sm" data-att-member="${r.member_id}" data-att-status="NO_SHOW">✕ ไม่มา (NO_SHOW)</button>
                                          </div>`
                                    }
                                  </td>
                                </tr>
                              `;
                            })
                            .join("")
                    }
                  </tbody>
                </table>
              </div>
            </div>
          `
      }
    `;
  }

  /* -----------------------------------------------------------------------
     VIEW 4: Admin Back-Office Portal
     ----------------------------------------------------------------------- */
  function renderAdminView() {
    const subTabs = [
      { id: "overview", label: "📊 ภาพรวมระบบ (Overview)" },
      { id: "gate", label: "🚪 จุดสแกนประตู & Concurrency (จำลอง)" },
      { id: "crud", label: "🗄️ จัดการฐานข้อมูล 7 ตาราง (CRUD)" },
      { id: "query", label: "⚡ ทดสอบ SQL Query & JOIN" },
      { id: "er", label: "📐 ER Diagram & Data Dictionary 35 คอลัมน์" }
    ];

    let innerHtml = "";
    if (state.adminTab === "overview") innerHtml = renderAdminOverview();
    else if (state.adminTab === "gate") innerHtml = renderAdminGateConcurrency();
    else if (state.adminTab === "crud") innerHtml = renderAdminCrud();
    else if (state.adminTab === "query") innerHtml = renderAdminQueryTester();
    else if (state.adminTab === "er") innerHtml = renderAdminErDictionary();

    return `
      <div class="sub-tabs">
        ${subTabs
          .map(
            (t) => `<button type="button" class="sub-tab ${state.adminTab === t.id ? "active" : ""}" data-admin-tab="${t.id}">${t.label}</button>`
          )
          .join("")}
      </div>
      ${innerHtml}
    `;
  }

  function renderAdminOverview() {
    const activeMembers = db.MEMBER.filter((m) => getMemberSubscriptionSummary(m.member_id).status === "ACTIVE").length;
    const expiredMembers = db.MEMBER.length - activeMembers;
    const confirmedBookings = db.CLASS_BOOKING.filter((b) => b.booking_status === "BOOKED" || b.booking_status === "ATTENDED").length;

    return `
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">สมาชิกสถานะ ACTIVE <span class="db-badge derived">subscription_status</span></div>
          <div class="kpi-value" style="color:var(--emerald-dark);">${activeMembers} <span style="font-size:0.95rem; color:var(--text-muted);">/ ${db.MEMBER.length} คน</span></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">สมาชิกหมดอายุ (EXPIRED) <span class="db-badge rule">BR-8 Blocked</span></div>
          <div class="kpi-value" style="color:var(--rose);">${expiredMembers}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">การจองคลาสที่ยืนยัน <span class="db-badge">CLASS_BOOKING</span></div>
          <div class="kpi-value" style="color:var(--sky);">${confirmedBookings}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">รายการสแกนเข้ายิมทั้งหมด <span class="db-badge">CHECK_IN</span></div>
          <div class="kpi-value">${db.CHECK_IN.length}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">สถานะสมาชิกทั้งหมดและค่า Derived Attributes แบบเรียลไทม์</h3>
            <p class="card-subtitle">แสดงการคำนวณ <code>age</code> จาก <code>birth_date</code> และ <code>subscription_status</code> จาก <code>MAX(end_date) >= TODAY</code></p>
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>member_id <span class="db-badge pk">PK</span></th>
                <th>ชื่อ-นามสกุล</th>
                <th>อายุ <span class="db-badge derived">Derived: age</span></th>
                <th>แพ็กเกจล่าสุด <span class="db-badge">SUBSCRIPTION</span></th>
                <th>วันหมดอายุสูงสุด <span class="db-badge">MAX(end_date)</span></th>
                <th>สถานะสิทธิ์ <span class="db-badge derived">subscription_status</span></th>
                <th>จำนวนครั้งเช็คอิน <span class="db-badge">MAX(check_in_no)</span></th>
              </tr>
            </thead>
            <tbody>
              ${db.MEMBER.map((m) => {
                const sub = getMemberSubscriptionSummary(m.member_id);
                const ciCount = db.CHECK_IN.filter((c) => c.member_id === m.member_id).length;
                return `
                  <tr>
                    <td class="mono"><strong>${m.member_id}</strong></td>
                    <td>${m.first_name} ${m.last_name}</td>
                    <td>${calcAge(m.birth_date)} ปี</td>
                    <td>${sub.plan ? `${sub.plan.plan_id} (${sub.plan.plan_name})` : "-"}</td>
                    <td class="mono">${sub.maxEndDate || "-"}</td>
                    <td>
                      ${
                        sub.status === "ACTIVE"
                          ? `<span class="badge badge-active">ACTIVE</span>`
                          : `<span class="badge badge-expired">EXPIRED</span>`
                      }
                    </td>
                    <td><strong>${ciCount}</strong> ครั้ง</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderAdminGateConcurrency() {
    return `
      <div class="sim-banner">
        ⚠️ <strong>หมายเหตุสำคัญสำหรับนำเสนอ:</strong> ส่วนแสดงคำสั่ง SQL <code>BEGIN TRANSACTION ... FOR UPDATE ... COMMIT</code> ด้านล่างนี้
        เป็น <strong>"การจำลอง (Simulation)"</strong> การทำงานของระบบจัดการภาวะพร้อมกัน (Concurrency Control) บนต้นแบบ <code>localStorage</code>
        หากต้องการรัน Transaction จริงบน MySQL/InnoDB สามารถนำสคริปต์ <code>schema.sql</code> ไปรันบนเซิร์ฟเวอร์ฐานข้อมูลได้ทันที
      </div>

      <div class="member-profile-grid">
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">จุดสแกนเช็คอินหน้าประตู (Gate Check-in Terminal)</h3>
              <p class="card-subtitle">บังคับใช้กฎ <strong>BR-8</strong> และคำนวณ Weak Entity Partial Key <code>check_in_no = MAX + 1</code></p>
            </div>
          </div>

          <div class="form-group">
            <label for="gateMemberSelect">เลือกรหัสสมาชิกที่สแกนบัตร <span class="db-badge pk">CHECK_IN.member_id</span></label>
            <select id="gateMemberSelect">
              ${db.MEMBER.map((m) => {
                const st = getMemberSubscriptionSummary(m.member_id).status;
                return `<option value="${m.member_id}">${m.member_id} — ${m.first_name} ${m.last_name} [${st}]</option>`;
              }).join("")}
            </select>
          </div>

          <div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:16px;">
            <button type="button" class="btn btn-primary" id="btnGateRunLock">
              🔒 สแกนเช็คอิน (จำลอง Transaction + FOR UPDATE)
            </button>
            <button type="button" class="btn btn-outline-danger" id="btnGateRaceSim">
              ⚡ จำลอง Race Condition (2 เครื่องสแกนพร้อมกันโดยไม่ใช้ Lock)
            </button>
          </div>

          <div style="margin-top:18px; padding:12px; background:var(--bg-subtle); border-radius:10px; font-size:0.84rem;">
            <strong>หลักการป้องกัน Key ซ้ำใน Weak Entity (CHECK_IN):</strong><br/>
            เนื่องจาก <code>check_in_no</code> เป็น Partial Key ที่ต้องบวกต่อจาก <code>SELECT COALESCE(MAX(check_in_no), 0) + 1</code>
            การใช้ <code>FOR UPDATE</code> บนแถวของ <code>MEMBER</code> จะช่วยล็อกไม่ให้ 2 Transaction อ่านค่า <code>MAX</code> เดียวกันพร้อมกันจนเกิด Error <code>Duplicate entry for key 'PRIMARY'</code>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">SQL Transaction Log (การจำลอง)</h3>
              <p class="card-subtitle">บันทึกขั้นตอนการทำงานของ Transaction และผลลัพธ์</p>
            </div>
            <button type="button" class="btn btn-outline btn-sm" id="btnClearSqlLog">ล้าง Log</button>
          </div>
          <div class="sql-console" id="sqlConsoleBox">
            ${state.concurrencyLogs
              .map((l) => `<div class="log-line-${l.type}">${l.text}</div>`)
              .join("")}
          </div>
        </div>
      </div>
    `;
  }

  function renderAdminCrud() {
    const tables = [
      { name: "MEMBER", cols: 7 },
      { name: "MEMBERSHIP_PLAN", cols: 4 },
      { name: "SUBSCRIPTION", cols: 4 },
      { name: "TRAINER", cols: 5 },
      { name: "CLASS_SCHEDULE", cols: 8 },
      { name: "CLASS_BOOKING", cols: 4 },
      { name: "CHECK_IN", cols: 3 }
    ];

    const activeTable = state.crudTable;
    const rows = db[activeTable] || [];
    const tableCols = DATA_DICTIONARY.filter((d) => d.table === activeTable);

    return `
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">จัดการฐานข้อมูลทั้ง 7 ตาราง (INSERT · UPDATE · DELETE)</h3>
            <p class="card-subtitle">
              บังคับใช้ <code>ON DELETE RESTRICT</code> (ห้ามลบ TRAINER, MEMBERSHIP_PLAN, CLASS_SCHEDULE หากถูกอ้างอิงอยู่)
              และ <code>ON DELETE CASCADE</code> (ลบ MEMBER จะลบ SUBSCRIPTION, CLASS_BOOKING, CHECK_IN ที่เกี่ยวข้องอัตโนมัติ)
            </p>
          </div>
        </div>

        <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:18px;">
          ${tables
            .map(
              (t) => `<button type="button" class="btn btn-sm ${activeTable === t.name ? "btn-primary" : "btn-outline"}" data-crud-table="${t.name}">
                ${t.name} (${t.cols} คอลัมน์ · ${(db[t.name] || []).length} แถว)
              </button>`
            )
            .join("")}
        </div>

        <form id="crudInsertForm" style="background:var(--bg-subtle); padding:16px; border-radius:12px; margin-bottom:18px;">
          <div style="font-weight:700; margin-bottom:10px; font-size:0.92rem;">
            + เพิ่มข้อมูลใหม่ลงตาราง <code>${activeTable}</code> (${tableCols.length} คอลัมน์)
          </div>
          <div class="form-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
            ${tableCols
              .map((c) => {
                if (c.col === "member_id" && activeTable !== "MEMBER") {
                  return `
                    <div class="form-group">
                      <label>${c.col} (${c.key})</label>
                      <select name="${c.col}" required>
                        ${db.MEMBER.map((m) => `<option value="${m.member_id}">${m.member_id} (${m.first_name})</option>`).join("")}
                      </select>
                    </div>`;
                }
                if (c.col === "plan_id" && activeTable !== "MEMBERSHIP_PLAN") {
                  return `
                    <div class="form-group">
                      <label>${c.col} (${c.key})</label>
                      <select name="${c.col}" required>
                        ${db.MEMBERSHIP_PLAN.map((p) => `<option value="${p.plan_id}">${p.plan_id} (${p.plan_name})</option>`).join("")}
                      </select>
                    </div>`;
                }
                if (c.col === "trainer_id" && activeTable !== "TRAINER") {
                  return `
                    <div class="form-group">
                      <label>${c.col} (${c.key})</label>
                      <select name="${c.col}" required>
                        ${db.TRAINER.map((t) => `<option value="${t.trainer_id}">${t.trainer_id} (${t.first_name})</option>`).join("")}
                      </select>
                    </div>`;
                }
                if (c.col === "schedule_id" && activeTable !== "CLASS_SCHEDULE") {
                  return `
                    <div class="form-group">
                      <label>${c.col} (${c.key})</label>
                      <select name="${c.col}" required>
                        ${db.CLASS_SCHEDULE.map((s) => `<option value="${s.schedule_id}">${s.schedule_id} (${s.class_name})</option>`).join("")}
                      </select>
                    </div>`;
                }
                if (c.col === "booking_status") {
                  return `
                    <div class="form-group">
                      <label>${c.col}</label>
                      <select name="${c.col}" required>
                        <option value="BOOKED">BOOKED</option>
                        <option value="CANCELLED">CANCELLED</option>
                        <option value="ATTENDED">ATTENDED</option>
                        <option value="NO_SHOW">NO_SHOW</option>
                      </select>
                    </div>`;
                }
                if (c.col === "end_date" && activeTable === "SUBSCRIPTION") {
                  return `
                    <div class="form-group">
                      <label>${c.col} (คำนวณอัตโนมัติจากแพ็กเกจ)</label>
                      <input type="text" name="${c.col}" value="AUTO (start_date + duration_months)" disabled />
                    </div>`;
                }
                if (c.col === "check_in_no" && activeTable === "CHECK_IN") {
                  return `
                    <div class="form-group">
                      <label>${c.col} (Weak PK)</label>
                      <input type="text" name="${c.col}" value="AUTO (MAX + 1 ต่อสมาชิก)" disabled />
                    </div>`;
                }

                let inputType = "text";
                let defaultVal = "";
                let placeholder = c.type;
                let requiredAttr = c.col === "email" ? "" : "required";

                if (c.type === "DATE") {
                  inputType = "date";
                  defaultVal = c.col === "birth_date" ? "1997-06-15" : getTodayStr();
                } else if (c.type === "TIME") {
                  inputType = "time";
                  defaultVal = c.col === "start_time" ? "10:00" : "11:00";
                } else if (c.type === "DATETIME") {
                  inputType = "text";
                  defaultVal = formatDateTimeNow();
                } else if (c.type.startsWith("INT") || c.type.startsWith("DECIMAL")) {
                  inputType = "number";
                  defaultVal = c.col === "max_seats" ? "10" : c.col === "duration_months" ? "1" : "1500";
                }

                return `
                  <div class="form-group">
                    <label>${c.col} <span style="color:var(--text-muted); font-weight:400;">(${c.type})</span></label>
                    <input type="${inputType}" name="${c.col}" value="${defaultVal}" placeholder="${placeholder}" ${requiredAttr} />
                  </div>`;
              })
              .join("")}
          </div>
          <div class="form-actions" style="margin-top:12px;">
            <button type="submit" class="btn btn-primary btn-sm">+ บันทึกแถวใหม่ลง ${activeTable} (INSERT)</button>
          </div>
        </form>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                ${tableCols.map((c) => `<th>${c.col} <span class="db-badge">${c.key}</span></th>`).join("")}
                <th>จัดการแถว (UPDATE / DELETE)</th>
              </tr>
            </thead>
            <tbody>
              ${
                rows.length === 0
                  ? `<tr><td colspan="${tableCols.length + 1}" style="text-align:center; color:var(--text-muted);">ไม่มีข้อมูลในตารางนี้</td></tr>`
                  : rows
                      .map((row, idx) => {
                        return `
                          <tr>
                            ${tableCols
                              .map((c) => {
                                const val = row[c.col];
                                return `<td class="mono">${val === null || val === undefined ? "<em>NULL</em>" : val}</td>`;
                              })
                              .join("")}
                            <td>
                              <div style="display:flex; gap:6px;">
                                <button type="button" class="btn btn-outline btn-sm" data-edit-table="${activeTable}" data-edit-idx="${idx}">
                                  ✏️ แก้ไข
                                </button>
                                <button type="button" class="btn btn-outline-danger btn-sm" data-delete-table="${activeTable}" data-delete-idx="${idx}">
                                  🗑️ ลบ
                                </button>
                              </div>
                            </td>
                          </tr>
                        `;
                      })
                      .join("")
              }
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  /* -----------------------------------------------------------------------
     NEW ADMIN MODULE: Live Relational SQL Query & JOIN Tester
     ----------------------------------------------------------------------- */
  function renderAdminQueryTester() {
    const today = getTodayStr();
    const presets = {
      q_active_members: {
        title: "1. ค้นหาสมาชิกที่มีสิทธิ์ใช้งานอยู่ (ACTIVE) พร้อมคำนวณอายุ (Derived Attributes)",
        sql: `SELECT M.member_id, CONCAT(M.first_name, ' ', M.last_name) AS full_name,
       TIMESTAMPDIFF(YEAR, M.birth_date, CURDATE()) AS age,
       MAX(S.end_date) AS max_end_date,
       'ACTIVE' AS subscription_status
FROM MEMBER M
JOIN SUBSCRIPTION S ON M.member_id = S.member_id
GROUP BY M.member_id, M.first_name, M.last_name, M.birth_date
HAVING MAX(S.end_date) >= '${today}';`,
        run: () =>
          db.MEMBER.map((m) => {
            const sub = getMemberSubscriptionSummary(m.member_id);
            return {
              member_id: m.member_id,
              full_name: `${m.first_name} ${m.last_name}`,
              age: calcAge(m.birth_date),
              max_end_date: sub.maxEndDate,
              subscription_status: sub.status
            };
          }).filter((r) => r.subscription_status === "ACTIVE")
      },
      q_class_seats: {
        title: "2. ตรวจสอบตารางคลาส เทรนเนอร์ผู้สอน และที่นั่งว่างคงเหลือ (3-Table JOIN + Derived seats_remaining)",
        sql: `SELECT CS.schedule_id, CS.class_name, CS.class_date, CS.room,
       CONCAT(T.first_name, ' ', T.last_name) AS trainer_name,
       CS.max_seats,
       (CS.max_seats - COUNT(CB.member_id)) AS seats_remaining
FROM CLASS_SCHEDULE CS
JOIN TRAINER T ON CS.trainer_id = T.trainer_id
LEFT JOIN CLASS_BOOKING CB
  ON CS.schedule_id = CB.schedule_id AND CB.booking_status <> 'CANCELLED'
GROUP BY CS.schedule_id;`,
        run: () =>
          db.CLASS_SCHEDULE.map((cs) => {
            const tr = db.TRAINER.find((t) => t.trainer_id === cs.trainer_id);
            return {
              schedule_id: cs.schedule_id,
              class_name: cs.class_name,
              class_date: cs.class_date,
              room: cs.room,
              trainer_name: tr ? `${tr.first_name} ${tr.last_name}` : cs.trainer_id,
              max_seats: cs.max_seats,
              seats_remaining: getSeatsRemaining(cs.schedule_id)
            };
          })
      },
      q_weak_checkin: {
        title: "3. รายงานสถิติการเข้ายิมของสมาชิกจาก Weak Entity (MEMBER LEFT JOIN CHECK_IN)",
        sql: `SELECT M.member_id, CONCAT(M.first_name, ' ', M.last_name) AS member_name,
       COALESCE(MAX(CI.check_in_no), 0) AS total_check_ins,
       MAX(CI.check_in_time) AS last_check_in
FROM MEMBER M
LEFT JOIN CHECK_IN CI ON M.member_id = CI.member_id
GROUP BY M.member_id, M.first_name, M.last_name
ORDER BY total_check_ins DESC;`,
        run: () =>
          db.MEMBER.map((m) => {
            const cis = db.CHECK_IN.filter((c) => c.member_id === m.member_id);
            const maxNo = cis.length ? Math.max(...cis.map((c) => Number(c.check_in_no))) : 0;
            const lastTime = cis.length
              ? [...cis].sort((a, b) => b.check_in_time.localeCompare(a.check_in_time))[0].check_in_time
              : "NULL";
            return {
              member_id: m.member_id,
              member_name: `${m.first_name} ${m.last_name}`,
              total_check_ins: maxNo,
              last_check_in: lastTime
            };
          }).sort((a, b) => b.total_check_ins - a.total_check_ins)
      }
    };

    const current = presets[state.selectedPresetQuery] || presets.q_active_members;
    const resultRows = current.run();
    const cols = resultRows.length > 0 ? Object.keys(resultRows[0]) : [];

    return `
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">ตัวทดสอบคำสั่ง SQL เชิงสัมพันธ์ (Relational Query &amp; JOIN Tester)</h3>
            <p class="card-subtitle">เลือกชุดคำสั่ง SQL เพื่อดูการดึงข้อมูลข้ามตาราง (JOIN) และการคำนวณ Derived Attributes จากฐานข้อมูลปัจจุบัน</p>
          </div>
        </div>

        <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px;">
          ${Object.entries(presets)
            .map(
              ([key, val]) => `<button type="button" class="btn btn-sm ${state.selectedPresetQuery === key ? "btn-indigo" : "btn-outline"}" data-preset-q="${key}">
                ${val.title.split("(")[0]}
              </button>`
            )
            .join("")}
        </div>

        <pre class="sql-code-block" style="margin-bottom:18px;">${current.sql}</pre>

        <div style="font-weight:700; margin-bottom:10px;">ผลลัพธ์จากการประมวลผลข้อมูลจริง (${resultRows.length} แถว):</div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>${cols.map((c) => `<th class="mono">${c}</th>`).join("")}</tr>
            </thead>
            <tbody>
              ${
                resultRows.length === 0
                  ? `<tr><td colspan="5" style="text-align:center;">ไม่พบผลลัพธ์</td></tr>`
                  : resultRows
                      .map(
                        (r) => `<tr>${cols.map((c) => `<td class="mono">${r[c]}</td>`).join("")}</tr>`
                      )
                      .join("")
              }
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderAdminErDictionary() {
    return `
      <!-- Chen Notation ER Diagram -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">ER Diagram (Chen Notation) — 4 Strong Entities · 1 Weak Entity · 4 Relationships</h3>
            <p class="card-subtitle">
              แสดงสัญลักษณ์ข้าวหลามตัด (◇) สำหรับ Relationship ปกติ, ข้าวหลามตัดคู่ (◇◇) สำหรับ Identifying Relationship และเส้นคู่ (═) สำหรับ Total Participation
            </p>
          </div>
        </div>

        <div class="er-diagram-box">
          <svg viewBox="0 0 1120 470" width="100%" style="min-width:880px; display:block; margin:0 auto;" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <style>
                .ent-box { fill: #FFFFFF; stroke: #0F172A; stroke-width: 2.2; }
                .weak-outer { fill: #FFFBEB; stroke: #D97706; stroke-width: 2.2; }
                .weak-inner { fill: none; stroke: #D97706; stroke-width: 1.5; }
                .rel-diamond { fill: #ECFDF5; stroke: #059669; stroke-width: 2.2; }
                .id-rel-outer { fill: #FEF3C7; stroke: #D97706; stroke-width: 2.2; }
                .id-rel-inner { fill: none; stroke: #D97706; stroke-width: 1.5; }
                .ent-txt { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 800; font-size: 13px; fill: #0F172A; text-anchor: middle; }
                .rel-txt { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; font-size: 11px; fill: #065F46; text-anchor: middle; }
                .id-rel-txt { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; font-size: 10.5px; fill: #92400E; text-anchor: middle; }
                .card-txt { font-family: 'IBM Plex Mono', monospace; font-weight: 700; font-size: 12px; fill: #4F46E5; }
                .sub-note { font-family: 'Sarabun', sans-serif; font-size: 11px; fill: #64748B; text-anchor: middle; }
                .line-partial { stroke: #334155; stroke-width: 2; }
                .line-total { stroke: #0F172A; stroke-width: 5.5; }
                .line-total-gap { stroke: #FFFFFF; stroke-width: 1.8; }
              </style>
            </defs>

            <line x1="210" y1="85" x2="380" y2="85" class="line-partial" />
            <text x="225" y="75" class="card-txt">N</text>

            <line x1="510" y1="85" x2="660" y2="85" class="line-total" />
            <line x1="510" y1="85" x2="660" y2="85" class="line-total-gap" />
            <text x="638" y="75" class="card-txt">M</text>

            <rect x="30" y="55" width="180" height="60" rx="6" class="ent-box" />
            <text x="120" y="83" class="ent-txt">MEMBERSHIP_PLAN</text>
            <text x="120" y="101" class="sub-note">PK: plan_id (4 คอลัมน์)</text>

            <polygon points="445,42 510,85 445,128 380,85" class="rel-diamond" />
            <text x="445" y="89" class="rel-txt">SUBSCRIBES</text>
            <text x="445" y="145" class="sub-note">→ ตาราง SUBSCRIPTION (4 คอลัมน์)</text>

            <rect x="660" y="55" width="180" height="60" rx="6" class="ent-box" />
            <text x="750" y="83" class="ent-txt">MEMBER</text>
            <text x="750" y="101" class="sub-note">PK: member_id (7 คอลัมน์)</text>

            <line x1="750" y1="115" x2="750" y2="205" class="line-partial" />
            <text x="762" y="135" class="card-txt">1</text>

            <line x1="750" y1="295" x2="750" y2="365" class="line-total" />
            <line x1="750" y1="295" x2="750" y2="365" class="line-total-gap" />
            <text x="762" y="352" class="card-txt">N</text>

            <polygon points="750,205 825,250 750,295 675,250" class="id-rel-outer" />
            <polygon points="750,213 813,250 750,287 687,250" class="id-rel-inner" />
            <text x="750" y="254" class="id-rel-txt">HAS_CHECK_IN</text>

            <rect x="655" y="365" width="190" height="66" rx="6" class="weak-outer" />
            <rect x="661" y="371" width="178" height="54" rx="4" class="weak-inner" />
            <text x="750" y="395" class="ent-txt">CHECK_IN (Weak Entity)</text>
            <text x="750" y="413" class="sub-note">PK: (member_id, check_in_no)</text>

            <line x1="660" y1="105" x2="510" y2="235" class="line-partial" />
            <text x="642" y="135" class="card-txt">M</text>

            <line x1="445" y1="280" x2="445" y2="365" class="line-partial" />
            <text x="456" y="353" class="card-txt">N</text>

            <polygon points="445,192 510,235 445,278 380,235" class="rel-diamond" />
            <text x="445" y="239" class="rel-txt">BOOKS</text>
            <text x="295" y="239" class="sub-note">→ ตาราง CLASS_BOOKING (4 คอลัมน์)</text>

            <line x1="180" y1="398" x2="235" y2="398" class="line-partial" />
            <text x="190" y="388" class="card-txt">1</text>

            <line x1="335" y1="398" x2="365" y2="398" class="line-total" />
            <line x1="335" y1="398" x2="365" y2="398" class="line-total-gap" />
            <text x="350" y="388" class="card-txt">N</text>

            <rect x="20" y="368" width="160" height="60" rx="6" class="ent-box" />
            <text x="100" y="396" class="ent-txt">TRAINER</text>
            <text x="100" y="414" class="sub-note">PK: trainer_id (5 คอลัมน์)</text>

            <polygon points="285,360 335,398 285,436 235,398" class="rel-diamond" />
            <text x="285" y="402" class="rel-txt">TEACHES</text>

            <rect x="365" y="368" width="180" height="60" rx="6" class="ent-box" />
            <text x="455" y="396" class="ent-txt">CLASS_SCHEDULE</text>
            <text x="455" y="414" class="sub-note">PK: schedule_id (8 คอลัมน์)</text>
          </svg>
        </div>

        <div class="er-legend">
          <span>▭ <strong>Strong Entity</strong> (4 ตาราง: MEMBER, MEMBERSHIP_PLAN, TRAINER, CLASS_SCHEDULE)</span>
          <span>回 <strong>Weak Entity</strong> (1 ตาราง: CHECK_IN)</span>
          <span>◇ <strong>Relationship</strong> (SUBSCRIPTION และ CLASS_BOOKING คือตารางที่ได้จาก Relationship M:N)</span>
          <span>═ <strong>Total Participation</strong> (MEMBER–SUBSCRIBES, CLASS_SCHEDULE–TEACHES, CHECK_IN–HAS_CHECK_IN)</span>
        </div>

        <!-- Schema Transformation Summary Cards -->
        <div class="mapping-grid">
          <div class="mapping-card">
            <h4>1. กฎการตัด Derived Attributes</h4>
            <p>แอตทริบิวต์ที่คำนวณได้ (<code>age</code>, <code>subscription_status</code>, <code>seats_remaining</code>) จะแสดงใน ER Diagram แต่ <strong>ไม่สร้างเป็นคอลัมน์จริง</strong> เพื่อลดความซ้ำซ้อนและป้องกันค่าล้าสมัย</p>
          </div>
          <div class="mapping-card">
            <h4>2. ความสัมพันธ์แบบ 1:N (TEACHES)</h4>
            <p>นำ Primary Key ฝั่ง One (<code>TRAINER.trainer_id</code>) ไปฝากเป็น Foreign Key ในตารางฝั่ง Many (<code>CLASS_SCHEDULE.trainer_id</code>)</p>
          </div>
          <div class="mapping-card">
            <h4>3. ความสัมพันธ์แบบ M:N (SUBSCRIBES &amp; BOOKS)</h4>
            <p>แตกเป็นตารางกลาง (Middle Table) ได้แก่ <code>SUBSCRIPTION</code> และ <code>CLASS_BOOKING</code> โดยนำ PK ของทั้งสองฝั่งมารวมเป็น Composite Primary Key</p>
          </div>
          <div class="mapping-card">
            <h4>4. การแปลง Weak Entity (CHECK_IN)</h4>
            <p>นำ PK ของ Strong Entity (<code>MEMBER.member_id</code>) มารวมกับ Partial Key (<code>check_in_no</code>) เป็น Composite PK และกำหนด <code>ON DELETE CASCADE</code></p>
          </div>
        </div>
      </div>

      <!-- Full 35-Column Data Dictionary Table -->
      <div class="card section-gap">
        <div class="card-header">
          <div>
            <h3 class="card-title">ตาราง Data Dictionary ครบทั้ง 7 ตาราง 35 คอลัมน์ (Strict Consistency)</h3>
            <p class="card-subtitle">ชื่อคอลัมน์ ชนิดข้อมูล คีย์ และข้อบังคับในโค้ดตรงกับเอกสารออกแบบฐานข้อมูลทุกจุด 100%</p>
          </div>
          <span class="badge badge-active">7 Tables · 35 Columns · 3 Derived Attributes</span>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>ชื่อตาราง (Table)</th>
                <th>ชื่อคอลัมน์ (Column)</th>
                <th>ชนิดข้อมูล (Datatype)</th>
                <th>คีย์ (Key)</th>
                <th>ข้อบังคับ / กฎความสัมพันธ์</th>
                <th>คำอธิบาย</th>
              </tr>
            </thead>
            <tbody>
              ${DATA_DICTIONARY.map(
                (item, idx) => `
                  <tr>
                    <td>${idx + 1}</td>
                    <td class="mono"><strong>${item.table}</strong></td>
                    <td class="mono" style="color:var(--indigo); font-weight:600;">${item.col}</td>
                    <td class="mono">${item.type}</td>
                    <td>${item.key !== "-" ? `<span class="badge badge-booked">${item.key}</span>` : "-"}</td>
                    <td style="font-size:0.82rem;">${item.rule}</td>
                    <td>${item.desc}</td>
                  </tr>`
              ).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  /* -----------------------------------------------------------------------
     Main Render & Dynamic View Event Binding
     ----------------------------------------------------------------------- */
  function render() {
    const root = document.getElementById("appRoot");
    if (state.role === "home") {
      root.innerHTML = renderHomeView();
    } else if (state.role === "user") {
      root.innerHTML = renderUserView();
    } else if (state.role === "trainer") {
      root.innerHTML = renderTrainerView();
    } else if (state.role === "admin") {
      root.innerHTML = renderAdminView();
    }
    bindDynamicEvents();
  }

  function bindDynamicEvents() {
    document.querySelectorAll("[data-go-role]").forEach((btn) => {
      btn.addEventListener("click", () => setRole(btn.dataset.goRole));
    });

    document.querySelectorAll("[data-copy-role]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const url = new URL(window.location.href);
        url.searchParams.set("role", btn.dataset.copyRole);
        try {
          await navigator.clipboard.writeText(url.toString());
          showToast(`คัดลอกลิงก์ ?role=${btn.dataset.copyRole} เรียบร้อยแล้ว!`);
        } catch {
          showToast(`ลิงก์สำหรับบทบาทนี้: ${url.toString()}`, "warn");
        }
      });
    });

    // User Portal Events
    const memberSelect = document.getElementById("memberSelect");
    if (memberSelect) {
      memberSelect.addEventListener("change", (e) => {
        state.selectedMemberId = e.target.value;
        render();
      });
    }

    const btnOpenReg = document.getElementById("btnOpenRegisterModal");
    if (btnOpenReg) {
      btnOpenReg.addEventListener("click", openRegisterModal);
    }

    const btnSelfCheckIn = document.getElementById("btnSelfCheckIn");
    if (btnSelfCheckIn) {
      btnSelfCheckIn.addEventListener("click", () => {
        const res = performGateCheckIn(state.selectedMemberId);
        showToast(res.msg, res.ok ? "success" : "error");
        if (res.ok) render();
      });
    }

    const btnRenewPlan = document.getElementById("btnRenewPlan");
    if (btnRenewPlan) {
      btnRenewPlan.addEventListener("click", () => {
        const planId = document.getElementById("renewPlanSelect").value;
        const startDate = document.getElementById("renewStartDate").value;
        const res = performRenewSubscription(state.selectedMemberId, planId, startDate);
        showToast(res.msg, res.ok ? "success" : "error");
        if (res.ok) render();
      });
    }

    const btnPrevWeek = document.getElementById("btnPrevWeek");
    const btnThisWeek = document.getElementById("btnThisWeek");
    const btnNextWeek = document.getElementById("btnNextWeek");
    if (btnPrevWeek) btnPrevWeek.addEventListener("click", () => { state.weekOffset--; render(); });
    if (btnThisWeek) btnThisWeek.addEventListener("click", () => { state.weekOffset = 0; render(); });
    if (btnNextWeek) btnNextWeek.addEventListener("click", () => { state.weekOffset++; render(); });

    const classFilterSelect = document.getElementById("classFilterSelect");
    if (classFilterSelect) {
      classFilterSelect.addEventListener("change", (e) => {
        state.classFilter = e.target.value;
        render();
      });
    }

    document.querySelectorAll("[data-book-sched]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const res = performClassBooking(state.selectedMemberId, btn.dataset.bookSched);
        showToast(res.msg, res.ok ? "success" : "error");
        if (res.ok) render();
      });
    });

    document.querySelectorAll("[data-cancel-sched]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const res = performCancelBooking(state.selectedMemberId, btn.dataset.cancelSched);
        showToast(res.msg, res.ok ? "success" : "error");
        if (res.ok) render();
      });
    });

    // Trainer Portal Events
    const trainerSelect = document.getElementById("trainerSelect");
    if (trainerSelect) {
      trainerSelect.addEventListener("change", (e) => {
        state.selectedTrainerId = e.target.value;
        render();
      });
    }

    const trainerClassSelect = document.getElementById("trainerClassSelect");
    if (trainerClassSelect) {
      trainerClassSelect.addEventListener("change", (e) => {
        state.selectedScheduleId = e.target.value;
        render();
      });
    }

    document.querySelectorAll("[data-att-member]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mId = btn.dataset.attMember;
        const newStatus = btn.dataset.attStatus;
        const row = db.CLASS_BOOKING.find(
          (b) => b.member_id === mId && b.schedule_id === state.selectedScheduleId
        );
        if (row) {
          row.booking_status = newStatus;
          saveDatabase();
          showToast(`อัปเดตสถานะของ ${mId} เป็น ${newStatus} เรียบร้อยแล้ว`);
          render();
        }
      });
    });

    // Admin Sub-Tabs
    document.querySelectorAll("[data-admin-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.adminTab = btn.dataset.adminTab;
        render();
      });
    });

    // Admin Preset Query Selector
    document.querySelectorAll("[data-preset-q]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.selectedPresetQuery = btn.dataset.presetQ;
        render();
      });
    });

    // Admin Gate & Concurrency Simulation Events
    const btnGateRunLock = document.getElementById("btnGateRunLock");
    if (btnGateRunLock) {
      btnGateRunLock.addEventListener("click", () => {
        const mId = document.getElementById("gateMemberSelect").value;
        const subInfo = getMemberSubscriptionSummary(mId);
        const nextNo = getNextCheckInNo(mId);
        state.concurrencyLogs.push(
          { type: "sql", text: `[SIMULATION] BEGIN TRANSACTION;` },
          { type: "sql", text: `[SIMULATION] SELECT member_id FROM MEMBER WHERE member_id = '${mId}' FOR UPDATE;` },
          { type: "sql", text: `[SIMULATION] SELECT MAX(end_date) FROM SUBSCRIPTION WHERE member_id = '${mId}'; -- Status: ${subInfo.status}` }
        );
        const res = performGateCheckIn(mId);
        if (res.ok) {
          state.concurrencyLogs.push(
            { type: "sql", text: `[SIMULATION] INSERT INTO CHECK_IN(member_id, check_in_no, check_in_time) VALUES ('${mId}', ${nextNo}, '${res.record.check_in_time}');` },
            { type: "ok", text: `[SIMULATION] COMMIT; -> สำเร็จ (${res.msg})` }
          );
          showToast(res.msg, "success");
        } else {
          state.concurrencyLogs.push(
            { type: "err", text: `[SIMULATION] ROLLBACK; -> ${res.msg}` }
          );
          showToast(res.msg, "error");
        }
        render();
      });
    }

    const btnGateRaceSim = document.getElementById("btnGateRaceSim");
    if (btnGateRaceSim) {
      btnGateRaceSim.addEventListener("click", () => {
        const mId = document.getElementById("gateMemberSelect").value;
        const nextNo = getNextCheckInNo(mId);
        state.concurrencyLogs.push(
          { type: "warn", text: `[SIMULATION] ⚠️ จำลอง 2 Gate สแกน ${mId} พร้อมกันโดยไม่ใช้ FOR UPDATE:` },
          { type: "sql", text: `  Gate-1: SELECT COALESCE(MAX(check_in_no),0)+1 -> ได้เลข #${nextNo}` },
          { type: "sql", text: `  Gate-2: SELECT COALESCE(MAX(check_in_no),0)+1 -> อ่านพร้อมกันได้เลข #${nextNo} ซ้ำ!` },
          { type: "err", text: `  Gate-2 ERROR 1062 (23000): Duplicate entry '${mId}-${nextNo}' for key 'CHECK_IN.PRIMARY'` }
        );
        showToast("จำลองเกิด Race Condition: Duplicate Primary Key สำเร็จ (ดูผลใน Console)", "warn");
        render();
      });
    }

    const btnClearSqlLog = document.getElementById("btnClearSqlLog");
    if (btnClearSqlLog) {
      btnClearSqlLog.addEventListener("click", () => {
        state.concurrencyLogs = [{ type: "sql", text: "-- ล้างหน้าจอ Log เรียบร้อยแล้ว" }];
        render();
      });
    }

    // Admin CRUD Manager Events
    document.querySelectorAll("[data-crud-table]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.crudTable = btn.dataset.crudTable;
        render();
      });
    });

    document.querySelectorAll("[data-edit-table]").forEach((btn) => {
      btn.addEventListener("click", () => {
        openEditModal(btn.dataset.editTable, Number(btn.dataset.editIdx));
      });
    });

    const crudForm = document.getElementById("crudInsertForm");
    if (crudForm) {
      crudForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const tbl = state.crudTable;
        const fd = new FormData(crudForm);
        const obj = {};
        for (const [k, v] of fd.entries()) {
          obj[k] = typeof v === "string" ? v.trim() : v;
        }

        if (tbl === "MEMBER") {
          obj.member_id = obj.member_id.toUpperCase();
          if (!/^M\d{5}$/.test(obj.member_id)) return showToast("member_id ต้องเป็นรูปแบบ M00001", "error");
          if (!/^\d{10}$/.test(obj.phone)) return showToast("phone ต้องเป็นตัวเลข 10 หลัก", "error");
          if (db.MEMBER.some((m) => m.member_id === obj.member_id)) return showToast("member_id ซ้ำ!", "error");
          if (!obj.email) obj.email = null;
          db.MEMBER.push(obj);
        } else if (tbl === "MEMBERSHIP_PLAN") {
          obj.plan_id = obj.plan_id.toUpperCase();
          if (!/^P\d{3}$/.test(obj.plan_id)) return showToast("plan_id ต้องเป็นรูปแบบ P001", "error");
          if (db.MEMBERSHIP_PLAN.some((p) => p.plan_id === obj.plan_id)) return showToast("plan_id ซ้ำ!", "error");
          obj.duration_months = Number(obj.duration_months);
          obj.price = Number(obj.price);
          if (obj.duration_months <= 0 || obj.price < 0) return showToast("ตรวจสอบค่า duration_months และ price", "error");
          db.MEMBERSHIP_PLAN.push(obj);
        } else if (tbl === "SUBSCRIPTION") {
          const res = performRenewSubscription(obj.member_id, obj.plan_id, obj.start_date);
          showToast(res.msg, res.ok ? "success" : "error");
          if (res.ok) render();
          return;
        } else if (tbl === "TRAINER") {
          obj.trainer_id = obj.trainer_id.toUpperCase();
          if (!/^T\d{3}$/.test(obj.trainer_id)) return showToast("trainer_id ต้องเป็นรูปแบบ T001", "error");
          if (!/^\d{10}$/.test(obj.phone)) return showToast("phone ต้องเป็นตัวเลข 10 หลัก", "error");
          if (db.TRAINER.some((t) => t.trainer_id === obj.trainer_id)) return showToast("trainer_id ซ้ำ!", "error");
          db.TRAINER.push(obj);
        } else if (tbl === "CLASS_SCHEDULE") {
          obj.schedule_id = obj.schedule_id.toUpperCase();
          if (!/^S\d{5}$/.test(obj.schedule_id)) return showToast("schedule_id ต้องเป็นรูปแบบ S00001", "error");
          if (db.CLASS_SCHEDULE.some((s) => s.schedule_id === obj.schedule_id)) return showToast("schedule_id ซ้ำ!", "error");
          obj.max_seats = Number(obj.max_seats);
          if (obj.max_seats <= 0) return showToast("max_seats ต้องมากกว่า 0", "error");
          if (obj.end_time <= obj.start_time) return showToast("end_time ต้องมากกว่า start_time", "error");
          db.CLASS_SCHEDULE.push(obj);
        } else if (tbl === "CLASS_BOOKING") {
          if (db.CLASS_BOOKING.some((b) => b.member_id === obj.member_id && b.schedule_id === obj.schedule_id)) {
            return showToast("Composite PK (member_id, schedule_id) ซ้ำ!", "error");
          }
          db.CLASS_BOOKING.push(obj);
        } else if (tbl === "CHECK_IN") {
          const res = performGateCheckIn(obj.member_id);
          showToast(res.msg, res.ok ? "success" : "error");
          if (res.ok) render();
          return;
        }

        saveDatabase();
        showToast(`เพิ่มข้อมูลลงตาราง ${tbl} สำเร็จ!`);
        render();
      });
    }

    document.querySelectorAll("[data-delete-table]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tbl = btn.dataset.deleteTable;
        const idx = Number(btn.dataset.deleteIdx);
        const target = db[tbl][idx];
        if (!target) return;

        if (tbl === "MEMBERSHIP_PLAN") {
          if (db.SUBSCRIPTION.some((s) => s.plan_id === target.plan_id)) {
            return showToast(`ON DELETE RESTRICT: ไม่สามารถลบแพ็กเกจ ${target.plan_id} ได้ เพราะมีข้อมูลอ้างอิงอยู่ในตาราง SUBSCRIPTION`, "error");
          }
        } else if (tbl === "TRAINER") {
          if (db.CLASS_SCHEDULE.some((c) => c.trainer_id === target.trainer_id)) {
            return showToast(`ON DELETE RESTRICT: ไม่สามารถลบเทรนเนอร์ ${target.trainer_id} ได้ เพราะมีรอบสอนอ้างอิงอยู่ในตาราง CLASS_SCHEDULE`, "error");
          }
        } else if (tbl === "CLASS_SCHEDULE") {
          if (db.CLASS_BOOKING.some((b) => b.schedule_id === target.schedule_id)) {
            return showToast(`ON DELETE RESTRICT: ไม่สามารถลบรอบคลาส ${target.schedule_id} ได้ เพราะมีประวัติการจองอยู่ในตาราง CLASS_BOOKING`, "error");
          }
        } else if (tbl === "MEMBER") {
          const mId = target.member_id;
          db.SUBSCRIPTION = db.SUBSCRIPTION.filter((s) => s.member_id !== mId);
          db.CLASS_BOOKING = db.CLASS_BOOKING.filter((b) => b.member_id !== mId);
          db.CHECK_IN = db.CHECK_IN.filter((c) => c.member_id !== mId);
          db[tbl].splice(idx, 1);
          saveDatabase();
          showToast(`ON DELETE CASCADE: ลบสมาชิก ${mId} พร้อมข้อมูลลูกใน SUBSCRIPTION, CLASS_BOOKING และ CHECK_IN เรียบร้อยแล้ว`, "warn");
          render();
          return;
        }

        db[tbl].splice(idx, 1);
        saveDatabase();
        showToast(`ลบข้อมูลจากตาราง ${tbl} เรียบร้อยแล้ว`);
        render();
      });
    });
  }

  /* -----------------------------------------------------------------------
     Bootstrap Application
     ----------------------------------------------------------------------- */
  setupGlobalEvents();
  setRole(state.role);
})();