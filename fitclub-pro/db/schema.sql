-- =========================================================================
-- FITCLUB PRO : ระบบสมาชิกฟิตเนสและจองคลาสออกกำลังกาย
-- MySQL 8.0+ Relational Schema (8 Tables · 44 Columns)
-- ตรงตาม ER Diagram & Data Dictionary v3
-- ลำดับการสร้าง: ADMIN ก่อน MEMBER (เพราะ MEMBER.admin_id อ้างอิง ADMIN)
-- =========================================================================

CREATE DATABASE IF NOT EXISTS fitclub_pro
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE fitclub_pro;

-- 1. ตาราง ADMIN (5 คอลัมน์) | Composite Attribute name -> first_name, last_name
--    password เก็บแบบ Hash เท่านั้น (BR-14)
CREATE TABLE ADMIN (
  admin_id    CHAR(4)       NOT NULL,
  first_name  VARCHAR(50)   NOT NULL,
  last_name   VARCHAR(50)   NOT NULL,
  username    VARCHAR(50)   NOT NULL,
  password    VARCHAR(255)  NOT NULL,
  PRIMARY KEY (admin_id),
  CONSTRAINT uq_admin_username UNIQUE (username),
  CONSTRAINT chk_admin_id CHECK (admin_id REGEXP '^A[0-9]{3}$')
) ENGINE=InnoDB;

-- 2. ตาราง MEMBER (9 คอลัมน์) | Derived Attribute: age (ไม่เก็บในตาราง)
--    admin_id มาจาก Relationship REGISTERS (1:N) — NULL ได้ (Partial Participation, BR-10)
CREATE TABLE MEMBER (
  member_id   CHAR(6)       NOT NULL,
  first_name  VARCHAR(50)   NOT NULL,
  last_name   VARCHAR(50)   NOT NULL,
  phone       CHAR(10)      NOT NULL,
  email       VARCHAR(100)  NOT NULL,
  birth_date  DATE          NOT NULL,
  join_date   DATE          NOT NULL,
  password    VARCHAR(255)  NOT NULL,
  admin_id    CHAR(4)       NULL,
  PRIMARY KEY (member_id),
  CONSTRAINT uq_member_email UNIQUE (email),
  CONSTRAINT fk_member_admin FOREIGN KEY (admin_id)
    REFERENCES ADMIN(admin_id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT chk_member_id CHECK (member_id REGEXP '^M[0-9]{5}$'),
  CONSTRAINT chk_member_phone CHECK (phone REGEXP '^[0-9]{10}$')
) ENGINE=InnoDB;

-- 3. ตาราง MEMBERSHIP_PLAN (4 คอลัมน์)
CREATE TABLE MEMBERSHIP_PLAN (
  plan_id          CHAR(4)       NOT NULL,
  plan_name        VARCHAR(50)   NOT NULL,
  duration_months  INT           NOT NULL,
  price            DECIMAL(8,2)  NOT NULL,
  PRIMARY KEY (plan_id),
  CONSTRAINT uq_plan_name UNIQUE (plan_name),
  CONSTRAINT chk_plan_id CHECK (plan_id REGEXP '^P[0-9]{3}$'),
  CONSTRAINT chk_plan_duration CHECK (duration_months BETWEEN 1 AND 99),
  CONSTRAINT chk_plan_price CHECK (price >= 0)
) ENGINE=InnoDB;

-- 4. ตาราง SUBSCRIPTION (4 คอลัมน์) — ตารางที่ได้จาก Relationship SUBSCRIBES (M:N)
--    Derived Attribute: subscription_status (ACTIVE เมื่อ MAX(end_date) >= CURDATE(), BR-7)
--    BR-6: สมาชิกทุกคนต้องมีอย่างน้อย 1 แถว (บังคับที่ระดับแอปพลิเคชัน)
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

-- 5. ตาราง TRAINER (7 คอลัมน์) | Composite Attribute name -> first_name, last_name
CREATE TABLE TRAINER (
  trainer_id  CHAR(4)       NOT NULL,
  first_name  VARCHAR(50)   NOT NULL,
  last_name   VARCHAR(50)   NOT NULL,
  phone       CHAR(10)      NOT NULL,
  specialty   VARCHAR(50)   NOT NULL,
  username    VARCHAR(50)   NOT NULL,
  password    VARCHAR(255)  NOT NULL,
  PRIMARY KEY (trainer_id),
  CONSTRAINT uq_trainer_username UNIQUE (username),
  CONSTRAINT chk_trainer_id CHECK (trainer_id REGEXP '^T[0-9]{3}$'),
  CONSTRAINT chk_trainer_phone CHECK (phone REGEXP '^[0-9]{10}$')
) ENGINE=InnoDB;

-- 6. ตาราง CLASS_SCHEDULE (8 คอลัมน์) | Derived Attribute: seats_remaining (BR-2)
--    trainer_id มาจาก Relationship TEACHES (1:N) — NOT NULL (Total Participation)
CREATE TABLE CLASS_SCHEDULE (
  schedule_id  CHAR(6)      NOT NULL,
  class_name   VARCHAR(50)  NOT NULL,
  class_date   DATE         NOT NULL,
  start_time   TIME         NOT NULL,
  end_time     TIME         NOT NULL,
  room         VARCHAR(20)  NOT NULL,
  max_seats    INT          NOT NULL,
  trainer_id   CHAR(4)      NOT NULL,
  PRIMARY KEY (schedule_id),
  CONSTRAINT fk_sched_trainer FOREIGN KEY (trainer_id)
    REFERENCES TRAINER(trainer_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_schedule_id CHECK (schedule_id REGEXP '^S[0-9]{5}$'),
  CONSTRAINT chk_max_seats CHECK (max_seats BETWEEN 1 AND 999),
  CONSTRAINT chk_class_time CHECK (end_time > start_time)
) ENGINE=InnoDB;

-- 7. ตาราง CLASS_BOOKING (4 คอลัมน์) — ตารางที่ได้จาก Relationship BOOKS (M:N)
--    BR-1  : จำนวนการจองที่ไม่ใช่ CANCELLED ต้องไม่เกิน max_seats   (ตรวจที่แอปพลิเคชัน/Transaction)
--    BR-12 : สมาชิกต้องมี SUBSCRIPTION ครอบคลุมวันที่เรียน            (ตรวจที่แอปพลิเคชัน)
--    BR-13 : ห้ามจองรอบที่ผ่านไปแล้ว                                  (ตรวจที่แอปพลิเคชัน)
CREATE TABLE CLASS_BOOKING (
  member_id         CHAR(6)      NOT NULL,
  schedule_id       CHAR(6)      NOT NULL,
  booking_datetime  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  booking_status    VARCHAR(10)  NOT NULL DEFAULT 'BOOKED',
  PRIMARY KEY (member_id, schedule_id),
  CONSTRAINT fk_book_member FOREIGN KEY (member_id)
    REFERENCES MEMBER(member_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_book_schedule FOREIGN KEY (schedule_id)
    REFERENCES CLASS_SCHEDULE(schedule_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_booking_status CHECK (
    booking_status IN ('BOOKED', 'CANCELLED', 'ATTENDED', 'NO_SHOW')
  )
) ENGINE=InnoDB;

-- 8. ตาราง CHECK_IN (3 คอลัมน์) — Weak Entity ของ MEMBER (Relationship HAS_CHECK_IN)
--    check_in_no = COALESCE(MAX(check_in_no), 0) + 1 ต่อสมาชิก
CREATE TABLE CHECK_IN (
  member_id      CHAR(6)   NOT NULL,
  check_in_no    INT       NOT NULL,
  check_in_time  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (member_id, check_in_no),
  CONSTRAINT fk_checkin_member FOREIGN KEY (member_id)
    REFERENCES MEMBER(member_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_checkin_no CHECK (check_in_no >= 1)
) ENGINE=InnoDB;
