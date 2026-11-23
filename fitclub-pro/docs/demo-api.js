/* =====================================================================
   FITCLUB PRO — DEMO (GitHub Pages)
   ฐานข้อมูลจริงที่รันในเบราว์เซอร์ด้วย SQLite (sql.js / WebAssembly)
   แทนที่ Node + MySQL ของเวอร์ชันเต็ม — ตรรกะทุกเส้นทางพอร์ตจาก server.js
   โครงสร้าง 8 ตาราง 44 คอลัมน์ ตรงกับ schema.sql (MySQL) ทุกตาราง/คอลัมน์/PK/FK
   ข้อมูลอยู่ในหน่วยความจำของเบราว์เซอร์ — รีเฟรชหน้า = รีเซ็ตกลับเป็นข้อมูลตัวอย่าง
   ===================================================================== */
(function(root){
const HASH={A:'$2a$10$1QCZDTwXp4iJy/EyKuBc9unNW1nWFKTRgI4SBRW.z9z1/Xb7YXhPy',M:'$2a$10$Kxj65zPe48MqW.Ude4lUjeYSTXasHTlO6KAF3RboafIQD5P846SfK',T:'$2a$10$FXDQYQ9Wwwg7ZQkI8NQkMeHJCD3H5NLJey1IJNNM2hjvY7QhaJhZi'};

const SCHEMA=`
CREATE TABLE ADMIN (
  admin_id CHAR(4) NOT NULL, first_name VARCHAR(50) NOT NULL, last_name VARCHAR(50) NOT NULL,
  username VARCHAR(50) NOT NULL COLLATE NOCASE, password VARCHAR(255) NOT NULL,
  PRIMARY KEY (admin_id),
  CONSTRAINT uq_admin_username UNIQUE (username),
  CONSTRAINT chk_admin_id CHECK (admin_id GLOB 'A[0-9][0-9][0-9]')
);
CREATE TABLE MEMBER (
  member_id CHAR(6) NOT NULL, first_name VARCHAR(50) NOT NULL, last_name VARCHAR(50) NOT NULL,
  phone CHAR(10) NOT NULL, email VARCHAR(100) NOT NULL COLLATE NOCASE,
  birth_date DATE NOT NULL, join_date DATE NOT NULL, password VARCHAR(255) NOT NULL, admin_id CHAR(4) NULL,
  PRIMARY KEY (member_id),
  CONSTRAINT uq_member_email UNIQUE (email),
  CONSTRAINT fk_member_admin FOREIGN KEY (admin_id) REFERENCES ADMIN(admin_id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT chk_member_id CHECK (member_id GLOB 'M[0-9][0-9][0-9][0-9][0-9]'),
  CONSTRAINT chk_member_phone CHECK (phone GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
  CONSTRAINT chk_member_dates CHECK (date(birth_date)=birth_date AND date(join_date)=join_date)
);
CREATE TABLE MEMBERSHIP_PLAN (
  plan_id CHAR(4) NOT NULL, plan_name VARCHAR(50) NOT NULL, duration_months INT NOT NULL, price DECIMAL(8,2) NOT NULL,
  PRIMARY KEY (plan_id),
  CONSTRAINT uq_plan_name UNIQUE (plan_name),
  CONSTRAINT chk_plan_id CHECK (plan_id GLOB 'P[0-9][0-9][0-9]'),
  CONSTRAINT chk_plan_duration CHECK (duration_months BETWEEN 1 AND 99),
  CONSTRAINT chk_plan_price CHECK (price >= 0)
);
CREATE TABLE SUBSCRIPTION (
  member_id CHAR(6) NOT NULL, plan_id CHAR(4) NOT NULL, start_date DATE NOT NULL, end_date DATE NOT NULL,
  PRIMARY KEY (member_id, plan_id, start_date),
  CONSTRAINT fk_sub_member FOREIGN KEY (member_id) REFERENCES MEMBER(member_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_sub_plan FOREIGN KEY (plan_id) REFERENCES MEMBERSHIP_PLAN(plan_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_sub_dates CHECK (date(start_date)=start_date AND date(end_date)=end_date AND end_date >= start_date)
);
CREATE TABLE TRAINER (
  trainer_id CHAR(4) NOT NULL, first_name VARCHAR(50) NOT NULL, last_name VARCHAR(50) NOT NULL,
  phone CHAR(10) NOT NULL, specialty VARCHAR(50) NOT NULL, username VARCHAR(50) NOT NULL COLLATE NOCASE, password VARCHAR(255) NOT NULL,
  PRIMARY KEY (trainer_id),
  CONSTRAINT uq_trainer_username UNIQUE (username),
  CONSTRAINT chk_trainer_id CHECK (trainer_id GLOB 'T[0-9][0-9][0-9]'),
  CONSTRAINT chk_trainer_phone CHECK (phone GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]')
);
CREATE TABLE CLASS_SCHEDULE (
  schedule_id CHAR(6) NOT NULL, class_name VARCHAR(50) NOT NULL, class_date DATE NOT NULL,
  start_time TIME NOT NULL, end_time TIME NOT NULL, room VARCHAR(20) NOT NULL, max_seats INT NOT NULL, trainer_id CHAR(4) NOT NULL,
  PRIMARY KEY (schedule_id),
  CONSTRAINT fk_sched_trainer FOREIGN KEY (trainer_id) REFERENCES TRAINER(trainer_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_schedule_id CHECK (schedule_id GLOB 'S[0-9][0-9][0-9][0-9][0-9]'),
  CONSTRAINT chk_class_date CHECK (date(class_date)=class_date),
  CONSTRAINT chk_max_seats CHECK (max_seats BETWEEN 1 AND 999),
  CONSTRAINT chk_class_time CHECK (time(start_time)=start_time AND time(end_time)=end_time AND end_time > start_time)
);
CREATE TABLE CLASS_BOOKING (
  member_id CHAR(6) NOT NULL, schedule_id CHAR(6) NOT NULL,
  booking_datetime DATETIME NOT NULL DEFAULT (datetime('now','localtime')),
  booking_status VARCHAR(10) NOT NULL DEFAULT 'BOOKED',
  PRIMARY KEY (member_id, schedule_id),
  CONSTRAINT fk_book_member FOREIGN KEY (member_id) REFERENCES MEMBER(member_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_book_schedule FOREIGN KEY (schedule_id) REFERENCES CLASS_SCHEDULE(schedule_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_booking_dt CHECK (datetime(booking_datetime)=booking_datetime),
  CONSTRAINT chk_booking_status CHECK (booking_status IN ('BOOKED','CANCELLED','ATTENDED','NO_SHOW'))
);
CREATE TABLE CHECK_IN (
  member_id CHAR(6) NOT NULL, check_in_no INT NOT NULL,
  check_in_time DATETIME NOT NULL DEFAULT (datetime('now','localtime')),
  PRIMARY KEY (member_id, check_in_no),
  CONSTRAINT fk_checkin_member FOREIGN KEY (member_id) REFERENCES MEMBER(member_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_checkin_no CHECK (check_in_no >= 1),
  CONSTRAINT chk_checkin_dt CHECK (datetime(check_in_time)=check_in_time)
);`;

/* ---------- วันเวลา ---------- */
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const today=()=>ymd(new Date());
const nowStr=()=>{const d=new Date();return ymd(d)+' '+pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds())};
const dt=(d=0,m=0)=>{const x=new Date();x.setMonth(x.getMonth()+m);x.setDate(x.getDate()+d);return ymd(x)};
const addMonths=(s,n)=>{const[y,m,d]=s.split('-').map(Number),t=new Date(y,m-1+n,1),last=new Date(t.getFullYear(),t.getMonth()+1,0).getDate();t.setDate(Math.min(d,last));return ymd(t)};
const ageOf=b=>{const[y,m,d]=String(b).split('-').map(Number),t=new Date();let a=t.getFullYear()-y;if(t.getMonth()+1<m||(t.getMonth()+1===m&&t.getDate()<d))a--;return a};

/* ---------- ชั้นฐานข้อมูล ---------- */
let db,S=null;
const nz=p=>p.map(v=>v===undefined?null:v);
const all=(sql,p=[])=>{const st=db.prepare(sql);try{st.bind(nz(p));const r=[];while(st.step())r.push(st.getAsObject());return r}finally{st.free()}};
const one=(sql,p)=>all(sql,p)[0];
const run=(sql,p=[])=>{db.run(sql,nz(p));return db.getRowsModified()};
const bad=(m,s=400)=>{throw Object.assign(new Error(m),{status:s})};
const tx=f=>{db.run('BEGIN');try{const r=f();db.run('COMMIT');return r}catch(e){try{db.run('ROLLBACK')}catch(_){}throw e}};
const B=()=>root.dcodeIO&&root.dcodeIO.bcrypt||root.bcrypt||require('bcryptjs');
const hash=p=>{if(String(p||'').length<6)bad('รหัสผ่านต้องอย่างน้อย 6 ตัวอักษร');return B().hashSync(String(p),10)};
const nextId=(t,k,p,n)=>{const r=one(`SELECT COALESCE(MAX(CAST(SUBSTR(${k},2) AS INTEGER)),0)+1 m FROM ${t}`);return p+String(r.m).padStart(n,'0')};

/* แปลง error ของ SQLite เป็นข้อความเดียวกับ server.js */
const xl=(e,delOp)=>{if(e.status)return e;const m=String(e.message||'');
 const f=t=>Object.assign(new Error(t),{status:400});
 if(/UNIQUE constraint/.test(m))return f('ข้อมูลซ้ำกับที่มีอยู่แล้ว');
 if(/FOREIGN KEY/.test(m))return f(delOp?'ลบไม่ได้ เพราะมีข้อมูลอื่นอ้างอิงอยู่':'ไม่พบรหัสที่อ้างอิง');
 if(/CHECK constraint/.test(m))return f('ข้อมูลไม่ถูกต้องตามเงื่อนไข');
 if(/NOT NULL/.test(m))return f('กรุณากรอกข้อมูลให้ครบ');
 console.error(e);return Object.assign(new Error('เกิดข้อผิดพลาดของระบบ'),{status:500})};

/* ---------- ข้อมูลตัวอย่าง (ตรงกับ seed.js) ---------- */
const seed=()=>{
 const ins=(t,rows)=>rows.forEach(r=>run(`INSERT INTO ${t} VALUES (${r.map(()=>'?').join(',')})`,r));
 ins('ADMIN',[['A001','สุรชัย','ใจดี','admin_surachai',HASH.A],['A002','ปวีณา','ดูแลดี','admin_paweena',HASH.A]]);
 ins('MEMBERSHIP_PLAN',[['P001','Monthly Starter (1 เดือน)',1,1500],['P002','Quarterly Pro (3 เดือน)',3,3900],['P003','Annual Elite (12 เดือน)',12,12900]]);
 ins('MEMBER',[
  ['M00001','ธนวัฒน์','รัตนชัย','0812345678','thanawat@fitclub.th','1996-05-14',dt(0,-8),HASH.M,'A001'],
  ['M00002','ณัฐธิดา','วงศ์สุวรรณ','0898765432','natthida@fitclub.th','1999-11-22',dt(0,-1),HASH.M,null],
  ['M00003','ภูริพัฒน์','เจริญกิจ','0823456789','phuripat@fitclub.th','1992-08-03',dt(-40),HASH.M,'A001'],
  ['M00004','พิมพ์ชนก','ศิริวัฒน์','0865432109','pimchanok@fitclub.th','2001-02-19',dt(-12),HASH.M,'A002'],
  ['M00005','ศุภกร','กิตติไพศาล','0851122334','supakorn@fitclub.th','1988-09-30',dt(-5,-3),HASH.M,null]]);
 ins('SUBSCRIPTION',[['M00001','P002',dt(0,-8),dt(0,-5)],['M00001','P003',dt(0,-5),dt(0,7)],['M00002','P002',dt(0,-1),dt(0,2)],
  ['M00003','P001',dt(-40),dt(-10)],['M00004','P001',dt(-12),dt(18)],['M00005','P002',dt(-5,-3),dt(-5)]]);
 ins('TRAINER',[['T001','กฤตภาส','พลังไชย','0911112222','HIIT & Functional','trainer_krit',HASH.T],
  ['T002','อัญชลี','สุขสันต์','0922223333','Vinyasa Yoga & Pilates','trainer_anchalee',HASH.T],['T003','ภาคิน','แสนกล้า','0933334444','Muay Thai & Boxing','trainer_pakin',HASH.T]]);
 ins('CLASS_SCHEDULE',[['S00001','HIIT Burn Express',dt(-1),'09:00:00','10:00:00','Studio A',12,'T001'],
  ['S00002','Morning Flow Yoga',dt(1),'10:30:00','11:30:00','Zen Room',15,'T002'],['S00003','Muay Thai Fit',dt(2),'17:30:00','18:30:00','Combat Zone',10,'T003'],
  ['S00004','Core & Strength',dt(3),'18:00:00','19:00:00','Studio A',2,'T001'],['S00005','Core Pilates',dt(4),'14:00:00','15:00:00','Zen Room',12,'T002'],
  ['S00006','Cardio Boxing',dt(9),'17:00:00','18:00:00','Combat Zone',10,'T003']]);
 ins('CLASS_BOOKING',[['M00001','S00001',dt(-2)+' 14:20:00','BOOKED'],['M00002','S00001',dt(-1)+' 09:15:00','ATTENDED'],['M00004','S00001',dt(-1)+' 11:05:00','NO_SHOW'],
  ['M00001','S00004',dt()+' 08:30:00','BOOKED'],['M00002','S00004',dt()+' 08:45:00','BOOKED']]);
 ins('CHECK_IN',[['M00001',1,dt(-3)+' 08:12:10'],['M00001',2,dt(-1)+' 17:40:05'],['M00002',1,dt()+' 09:02:44']]);
};

/* ---------- ตรรกะธุรกิจ (พอร์ตจาก server.js) ---------- */
const ROLE={user:['MEMBER','member_id','email'],trainer:['TRAINER','trainer_id','username'],admin:['ADMIN','admin_id','username']};
const need=(...r)=>{if(!S)bad('กรุณาเข้าสู่ระบบ',401);if(S.role!=='admin'&&!r.includes(S.role))bad('ไม่มีสิทธิ์เข้าถึง',403)};

const register=(b,adminId)=>tx(()=>{
 const pl=one('SELECT * FROM MEMBERSHIP_PLAN WHERE plan_id=?',[b.plan_id]);if(!pl)bad('กรุณาเลือกแพ็กเกจ');
 if(!b.birth_date)bad('กรุณากรอกข้อมูลให้ครบ');if(b.birth_date>=today())bad('วันเกิดไม่ถูกต้อง');
 const pw=hash(b.password),id=nextId('MEMBER','member_id','M',5),t=today();
 run('INSERT INTO MEMBER (member_id,first_name,last_name,phone,email,birth_date,join_date,password,admin_id) VALUES (?,?,?,?,?,?,?,?,?)',[id,b.first_name,b.last_name,b.phone,b.email,b.birth_date,t,pw,adminId]);
 run('INSERT INTO SUBSCRIPTION (member_id,plan_id,start_date,end_date) VALUES (?,?,?,?)',[id,pl.plan_id,t,addMonths(t,pl.duration_months)]);
 return id});
const renew=b=>{const pl=one('SELECT * FROM MEMBERSHIP_PLAN WHERE plan_id=?',[b.plan_id]);if(!pl)bad('ไม่พบแพ็กเกจ');
 if(!b.start_date||isNaN(new Date(b.start_date)))bad('กรุณากรอกข้อมูลให้ครบ');
 run('INSERT INTO SUBSCRIPTION (member_id,plan_id,start_date,end_date) VALUES (?,?,?,?)',[b.member_id,pl.plan_id,b.start_date,addMonths(b.start_date,pl.duration_months)])};
const book=(m,s)=>tx(()=>{
 const x=one("SELECT class_date,max_seats,(class_date||' '||start_time)<? past FROM CLASS_SCHEDULE WHERE schedule_id=?",[nowStr(),s]);
 if(!x)bad('ไม่พบรอบคลาส',404);if(x.past)bad('รอบนี้ผ่านไปแล้ว');
 const cv=one('SELECT 1 x FROM SUBSCRIPTION WHERE member_id=? AND start_date<=? AND end_date>=? LIMIT 1',[m,x.class_date,x.class_date]);
 if(!cv)bad('แพ็กเกจของสมาชิกไม่ครอบคลุมวันที่เรียน');
 const n=one("SELECT COUNT(*) n FROM CLASS_BOOKING WHERE schedule_id=? AND booking_status<>'CANCELLED'",[s]).n;
 const ex=one('SELECT booking_status FROM CLASS_BOOKING WHERE member_id=? AND schedule_id=?',[m,s]);
 if(ex&&ex.booking_status!=='CANCELLED')bad('จองรอบนี้ไว้แล้ว');if(n>=x.max_seats)bad('ที่นั่งเต็มแล้ว');
 if(ex)run("UPDATE CLASS_BOOKING SET booking_status='BOOKED',booking_datetime=? WHERE member_id=? AND schedule_id=?",[nowStr(),m,s]);
 else run('INSERT INTO CLASS_BOOKING (member_id,schedule_id,booking_datetime) VALUES (?,?,?)',[m,s,nowStr()])});
const checkin=id=>tx(()=>{
 const m=one('SELECT first_name,last_name FROM MEMBER WHERE member_id=?',[id]);if(!m)bad('ไม่พบรหัสสมาชิก',404);
 const s=one('SELECT MAX(end_date) end_date FROM SUBSCRIPTION WHERE member_id=?',[id]),ok=!!s.end_date&&s.end_date>=today();
 const p=one('SELECT p.plan_name FROM SUBSCRIPTION s JOIN MEMBERSHIP_PLAN p USING(plan_id) WHERE s.member_id=? ORDER BY s.start_date DESC LIMIT 1',[id]);
 const o={name:m.first_name+' '+m.last_name,plan_name:p&&p.plan_name,end_date:s.end_date};
 if(!ok)return{ok:false,...o};
 run('INSERT INTO CHECK_IN (member_id,check_in_no,check_in_time) SELECT ?,COALESCE(MAX(check_in_no),0)+1,? FROM CHECK_IN WHERE member_id=?',[id,nowStr(),id]);
 const r=one('SELECT check_in_no,check_in_time FROM CHECK_IN WHERE member_id=? ORDER BY check_in_no DESC LIMIT 1',[id]);
 return{ok:true,...o,...r}});
const own=sid=>{const c=one("SELECT trainer_id,(class_date||' '||start_time)>? future FROM CLASS_SCHEDULE WHERE schedule_id=?",[nowStr(),sid]);
 if(!c||(S.role==='trainer'&&c.trainer_id!==S.id))bad('ไม่มีสิทธิ์',403);return c};

const T={
 MEMBER:{pk:['member_id'],auto:['M',5],cols:['member_id','first_name','last_name','phone','email','birth_date','join_date','password','admin_id'],ins:['first_name','last_name','phone','email','birth_date','password','plan_id']},
 MEMBERSHIP_PLAN:{pk:['plan_id'],auto:['P',3],cols:['plan_id','plan_name','duration_months','price']},
 SUBSCRIPTION:{pk:['member_id','plan_id','start_date'],cols:['member_id','plan_id','start_date','end_date'],ins:['member_id','plan_id','start_date']},
 TRAINER:{pk:['trainer_id'],auto:['T',3],cols:['trainer_id','first_name','last_name','phone','specialty','username','password']},
 CLASS_SCHEDULE:{pk:['schedule_id'],auto:['S',5],cols:['schedule_id','class_name','class_date','start_time','end_time','room','max_seats','trainer_id']},
 CLASS_BOOKING:{pk:['member_id','schedule_id'],cols:['member_id','schedule_id','booking_datetime','booking_status'],ins:['member_id','schedule_id']},
 CHECK_IN:{pk:['member_id','check_in_no'],cols:['member_id','check_in_no','check_in_time'],ins:['member_id']},
 ADMIN:{pk:['admin_id'],auto:['A',3],cols:['admin_id','first_name','last_name','username','password']}};
const tm=(c,v)=>/_time$/.test(c)&&c!=='check_in_time'&&/^\d\d:\d\d$/.test(v)?v+':00':v;  // HH:MM -> HH:MM:SS เหมือน MySQL
const val=(c,v)=>v===''||v===undefined?null:tm(c,v);

function route(u,method,b){
 const[pq,qs]=u.split('?'),P=pq.split('/'),Q=Object.fromEntries(new URLSearchParams(qs||'')),R=P[0];
 const mid=()=>S.role==='user'?S.id:b.member_id||Q.member_id;
 const GET=method==='GET',POST=method==='POST';

 if(R==='login'&&POST){const{role,ident,password}=b,r=ROLE[role];if(!r||!ident||!password)bad('กรอกข้อมูลให้ครบ');
  const x=one(`SELECT * FROM ${r[0]} WHERE ${r[2]}=?`,[ident]);
  if(!x||!B().compareSync(String(password),x.password))bad('อีเมล/ชื่อผู้ใช้ หรือรหัสผ่านไม่ถูกต้อง',401);
  S={role,id:x[r[1]],name:x.first_name+' '+x.last_name};return{...S}}
 if(R==='me')return S?{...S}:null;
 if(R==='logout'){S=null;return{}}
 if(R==='plans')return all('SELECT * FROM MEMBERSHIP_PLAN ORDER BY plan_id');
 if(R==='register'&&POST)return{member_id:register(b,S&&S.role==='admin'?S.id:null)};
 if(R==='gate'&&POST)return checkin(String(b.member_id||'').trim().toUpperCase());

 if(R==='book'){need('user');book(mid(),b.schedule_id);return{}}
 if(R==='cancel'){need('user');if(!run("UPDATE CLASS_BOOKING SET booking_status='CANCELLED' WHERE member_id=? AND schedule_id=? AND booking_status='BOOKED'",[mid(),b.schedule_id]))bad('ยกเลิกไม่ได้');return{}}

 if(R==='classes'){need('user','trainer');const{from,to}=Q,tid=S.role==='trainer'?S.id:Q.trainer_id,w=[],p=[S.role==='user'?S.id:null];
  if(from){w.push('c.class_date BETWEEN ? AND ?');p.push(from,to)}if(tid){w.push('c.trainer_id=?');p.push(tid)}
  return all(`SELECT c.*,t.first_name tf,t.last_name tl,c.max_seats-(SELECT COUNT(*) FROM CLASS_BOOKING b WHERE b.schedule_id=c.schedule_id AND b.booking_status<>'CANCELLED') seats_remaining,(SELECT booking_status FROM CLASS_BOOKING b WHERE b.schedule_id=c.schedule_id AND b.member_id=?) my_status FROM CLASS_SCHEDULE c JOIN TRAINER t USING(trainer_id)${w.length?' WHERE '+w.join(' AND '):''} ORDER BY c.class_date,c.start_time`,p)}
 if(R==='trainer'){need('trainer');return one('SELECT first_name,last_name,specialty FROM TRAINER WHERE trainer_id=?',[S.role==='trainer'?S.id:Q.trainer_id])||{}}
 if(R==='roster'){need('trainer');own(Q.schedule_id);
  return all('SELECT m.member_id,m.first_name,m.last_name,m.phone,b.booking_datetime,b.booking_status FROM CLASS_BOOKING b JOIN MEMBER m USING(member_id) WHERE b.schedule_id=? ORDER BY b.booking_datetime',[Q.schedule_id])}
 if(R==='attend'){need('trainer');const{schedule_id:s,member_id:m,status}=b;
  if(!['ATTENDED','NO_SHOW'].includes(status))bad('สถานะไม่ถูกต้อง');if(own(s).future)bad('คลาสยังไม่เริ่ม เช็คชื่อไม่ได้');
  if(!run("UPDATE CLASS_BOOKING SET booking_status=? WHERE schedule_id=? AND member_id=? AND booking_status<>'CANCELLED'",[status,s,m]))bad('ไม่พบการจอง');return{}}

 if(R==='profile'){need('user');const id=mid(),m=one('SELECT member_id,first_name,last_name,phone,email,birth_date,join_date FROM MEMBER WHERE member_id=?',[id]);if(!m)bad('ไม่พบสมาชิก',404);
  m.age=ageOf(m.birth_date);const a=one('SELECT MAX(end_date) e FROM SUBSCRIPTION WHERE member_id=?',[id]);
  return{m,active:!!a.e&&a.e>=today(),
   subs:all('SELECT s.start_date,s.end_date,p.plan_name,p.duration_months,p.price FROM SUBSCRIPTION s JOIN MEMBERSHIP_PLAN p USING(plan_id) WHERE s.member_id=? ORDER BY s.start_date DESC',[id]),
   checkins:all('SELECT check_in_no,check_in_time FROM CHECK_IN WHERE member_id=? ORDER BY check_in_no DESC',[id]),
   bookings:all('SELECT c.class_name,c.class_date,c.start_time,b.schedule_id,b.booking_datetime,b.booking_status FROM CLASS_BOOKING b JOIN CLASS_SCHEDULE c USING(schedule_id) WHERE b.member_id=? ORDER BY b.booking_datetime DESC',[id])}}
 if(R==='password'){need('user');const{old_password:o,new_password:n}=b,m=one('SELECT password FROM MEMBER WHERE member_id=?',[S.id]);
  if(!m||!B().compareSync(String(o||''),m.password))bad('รหัสผ่านเดิมไม่ถูกต้อง');run('UPDATE MEMBER SET password=? WHERE member_id=?',[hash(n),S.id]);return{}}

 if(R==='dashboard'){need();const t=today(),act=s=>`(SELECT MAX(end_date) FROM SUBSCRIPTION s WHERE s.member_id=m.member_id)${s}`;
  const members=all(`SELECT m.member_id,m.first_name,m.last_name,m.birth_date,(SELECT p.plan_name FROM SUBSCRIPTION s JOIN MEMBERSHIP_PLAN p USING(plan_id) WHERE s.member_id=m.member_id ORDER BY s.start_date DESC LIMIT 1) plan_name,${act(' end_date')},${act(">='"+t+"' active")},(SELECT COUNT(*) FROM CHECK_IN c WHERE c.member_id=m.member_id) check_ins,a.first_name af,a.last_name al FROM MEMBER m LEFT JOIN ADMIN a ON a.admin_id=m.admin_id ORDER BY m.member_id`)
   .map(({birth_date,...r})=>({...r,age:ageOf(birth_date),active:!!r.active}));
  return{members,
   classes:all("SELECT c.schedule_id,c.class_name,c.class_date,c.start_time,c.max_seats,c.max_seats-(SELECT COUNT(*) FROM CLASS_BOOKING b WHERE b.schedule_id=c.schedule_id AND b.booking_status<>'CANCELLED') seats_remaining FROM CLASS_SCHEDULE c WHERE c.class_date>=? ORDER BY c.class_date,c.start_time",[t]),
   recent:all('SELECT c.member_id,m.first_name,m.last_name,c.check_in_no,c.check_in_time FROM CHECK_IN c JOIN MEMBER m USING(member_id) ORDER BY c.check_in_time DESC LIMIT 10'),
   confirmed:one("SELECT COUNT(*) n FROM CLASS_BOOKING WHERE booking_status IN ('BOOKED','ATTENDED')").n,
   checkins:one('SELECT COUNT(*) n FROM CHECK_IN').n}}

 if(R==='meta'){need();return T}
 if(R==='t'){need();const t=P[1];if(!Object.hasOwn(T,t))bad('ไม่พบตาราง',404);const d=T[t];
  if(GET&&P.length===2)return all(`SELECT ${d.cols.filter(c=>c!=='password').join(',')} FROM ${t} ORDER BY ${d.pk.join(',')}`);
  if(POST){
   if(t==='MEMBER')register(b,S.id);else if(t==='SUBSCRIPTION')renew(b);else if(t==='CLASS_BOOKING')book(b.member_id,b.schedule_id);
   else if(t==='CHECK_IN'){if(!checkin(String(b.member_id||'').trim()).ok)bad('สมาชิกหมดอายุ เช็คอินไม่ได้')}
   else tx(()=>{const k=d.cols.filter(x=>x!==d.pk[0]),id=nextId(t,d.pk[0],...d.auto),v=[];
    for(const x of k)v.push(x==='password'?hash(b[x]):val(x,b[x]));
    run(`INSERT INTO ${t} (${[d.pk[0],...k].join(',')}) VALUES (${[id,...k].map(()=>'?').join(',')})`,[id,...v])});
   return{}}
  const key=decodeURIComponent(P[2]||'').split('|'),w=d.pk.map(c=>c+'=?').join(' AND ');
  if(method==='PUT'){const set=[],v=[];
   for(const x of d.cols.filter(c=>!d.pk.includes(c))){if(x==='password'){if(!b[x])continue;v.push(hash(b[x]))}else v.push(val(x,b[x]));set.push(x+'=?')}
   if(t==='CLASS_SCHEDULE'){const n=one("SELECT COUNT(*) n FROM CLASS_BOOKING WHERE schedule_id=? AND booking_status<>'CANCELLED'",[key[0]]).n;if(n>Number(b.max_seats))bad('ที่นั่งน้อยกว่าจำนวนผู้จองปัจจุบัน')}
   run(`UPDATE ${t} SET ${set.join(',')} WHERE ${w}`,[...v,...key]);return{}}
  if(method==='DELETE'){
   if(t==='SUBSCRIPTION'&&one('SELECT COUNT(*) n FROM SUBSCRIPTION WHERE member_id=?',[key[0]]).n<=1)bad('สมาชิกต้องมีประวัติแพ็กเกจอย่างน้อย 1 รายการ');
   if(t==='ADMIN'&&key[0]===S.id)bad('ลบบัญชีที่กำลังใช้งานอยู่ไม่ได้');
   run(`DELETE FROM ${t} WHERE ${w}`,key);return{}}}
 bad('ไม่พบเส้นทาง',404)}

/* ---------- เริ่มระบบ ---------- */
const init=async()=>{const SQL=await root.initSqlJs({locateFile:f=>'lib/'+f});
 db=new SQL.Database();db.run(SCHEMA);db.run('PRAGMA foreign_keys=ON');seed()};
const ready=init();
async function call(u,method='GET',body){await ready;
 try{return JSON.parse(JSON.stringify(route(u,method.toUpperCase(),body||{})??null))}catch(e){throw xl(e,method.toUpperCase()==='DELETE')}}
root.DEMO={ready,call,_db:()=>db,_reset:()=>{S=null}};
})(typeof window!=='undefined'?window:globalThis);
