const express=require('express'),session=require('express-session'),mysql=require('mysql2/promise'),bcrypt=require('bcryptjs'),path=require('path'),fs=require('fs'),E=process.env;
const pool=mysql.createPool({host:E.DB_HOST||'localhost',user:E.DB_USER||'root',password:E.DB_PASSWORD||'',database:'fitclub_pro',dateStrings:true,connectionLimit:10});
const app=express();app.use(express.json());
app.use(session({secret:E.SESSION_SECRET||'fitclub-dev-secret',resave:false,saveUninitialized:false}));
const PUB=path.join(__dirname,'public');
if(fs.existsSync(path.join(PUB,'index.html')))app.use(express.static(PUB));
else{console.warn('! ไม่พบโฟลเดอร์ public/ — ใช้ไฟล์หน้าเว็บในโฟลเดอร์เดียวกับ server.js แทน');
 app.get('/',(_,r)=>r.sendFile(path.join(__dirname,'index.html')));
 for(const f of['index.html','app.js','style.css'])app.get('/'+f,(_,r)=>r.sendFile(path.join(__dirname,f)))}
const q=async(s,p)=>(await pool.query(s,p))[0],cq=async(c,s,p)=>(await c.query(s,p))[0];
const bad=(m,s=400)=>{throw Object.assign(new Error(m),{status:s})};
const MSG={ER_DUP_ENTRY:'ข้อมูลซ้ำกับที่มีอยู่แล้ว',ER_NO_REFERENCED_ROW_2:'ไม่พบรหัสที่อ้างอิง',ER_ROW_IS_REFERENCED_2:'ลบไม่ได้ เพราะมีข้อมูลอื่นอ้างอิงอยู่',ER_CHECK_CONSTRAINT_VIOLATED:'ข้อมูลไม่ถูกต้องตามเงื่อนไข',ER_BAD_NULL_ERROR:'กรุณากรอกข้อมูลให้ครบ',ER_TRUNCATED_WRONG_VALUE:'รูปแบบข้อมูลไม่ถูกต้อง',ER_WRONG_VALUE:'รูปแบบข้อมูลไม่ถูกต้อง',ER_DATA_TOO_LONG:'ข้อมูลยาวเกินกำหนด'};
const DBERR={ECONNREFUSED:'เชื่อมต่อ MySQL ไม่ได้ — MySQL ยังไม่ได้เปิดใช้งาน',ER_ACCESS_DENIED_ERROR:'MySQL ปฏิเสธรหัสผ่าน — ตั้งค่า DB_PASSWORD ให้ถูกต้องแล้วเปิดเซิร์ฟเวอร์ใหม่',ER_BAD_DB_ERROR:'ยังไม่มีฐานข้อมูล fitclub_pro — ต้องรัน npm run seed ก่อน',ER_NO_SUCH_TABLE:'ฐานข้อมูลยังไม่มีตาราง — ต้องรัน npm run seed ก่อน'};
const h=f=>(req,res)=>f(req,res).catch(e=>{if(DBERR[e.code]){console.error('[DB]',DBERR[e.code]);return res.status(503).json({error:DBERR[e.code]})}if(!e.status&&!MSG[e.code])console.error(e);res.status(e.status||(MSG[e.code]?400:500)).json({error:e.status?e.message:MSG[e.code]||'เกิดข้อผิดพลาดของระบบ'})});
const need=(...r)=>(req,res,n)=>{const u=req.session.u;if(!u)return res.status(401).json({error:'กรุณาเข้าสู่ระบบ'});if(u.role!=='admin'&&!r.includes(u.role))return res.status(403).json({error:'ไม่มีสิทธิ์เข้าถึง'});n()};
const tx=async f=>{const c=await pool.getConnection();try{await c.beginTransaction();const r=await f(c);await c.commit();return r}catch(e){await c.rollback();throw e}finally{c.release()}};
const nextId=async(c,t,k,p,n)=>{const[{m}]=await cq(c,`SELECT COALESCE(MAX(CAST(SUBSTRING(${k},2) AS UNSIGNED)),0)+1 m FROM ${t}`);return p+String(m).padStart(n,'0')};
const hash=p=>{if(String(p||'').length<6)bad('รหัสผ่านต้องอย่างน้อย 6 ตัวอักษร');return bcrypt.hash(p,10)};
const mid=req=>req.session.u.role==='user'?req.session.u.id:(req.body&&req.body.member_id)||req.query.member_id;

const ROLE={user:['MEMBER','member_id','email'],trainer:['TRAINER','trainer_id','username'],admin:['ADMIN','admin_id','username']};
app.post('/api/login',h(async(req,res)=>{const{role,ident,password}=req.body,r=ROLE[role];if(!r||!ident||!password)bad('กรอกข้อมูลให้ครบ');
 const[u]=await q(`SELECT * FROM ${r[0]} WHERE ${r[2]}=?`,[ident]);
 if(!u||!(await bcrypt.compare(password,u.password)))bad('อีเมล/ชื่อผู้ใช้ หรือรหัสผ่านไม่ถูกต้อง',401);
 req.session.u={role,id:u[r[1]],name:u.first_name+' '+u.last_name};res.json(req.session.u)}));
app.get('/api/me',(req,res)=>res.json(req.session.u||null));
app.post('/api/logout',(req,res)=>req.session.destroy(()=>res.json({})));
app.get('/api/plans',h(async(_,res)=>res.json(await q('SELECT * FROM MEMBERSHIP_PLAN ORDER BY plan_id'))));

const register=(b,adminId)=>tx(async c=>{
 const[pl]=await cq(c,'SELECT * FROM MEMBERSHIP_PLAN WHERE plan_id=?',[b.plan_id]);if(!pl)bad('กรุณาเลือกแพ็กเกจ');
 const[{f}]=await cq(c,'SELECT ?>=CURDATE() f',[b.birth_date]);if(f)bad('วันเกิดไม่ถูกต้อง');
 const pw=await hash(b.password),id=await nextId(c,'MEMBER','member_id','M',5);
 await cq(c,'INSERT INTO MEMBER VALUES (?,?,?,?,?,?,CURDATE(),?,?)',[id,b.first_name,b.last_name,b.phone,b.email,b.birth_date,pw,adminId]);
 await cq(c,'INSERT INTO SUBSCRIPTION VALUES (?,?,CURDATE(),DATE_ADD(CURDATE(),INTERVAL ? MONTH))',[id,pl.plan_id,pl.duration_months]);
 return id});
app.post('/api/register',h(async(req,res)=>{const u=req.session.u;res.json({member_id:await register(req.body,u&&u.role==='admin'?u.id:null)})}));

const renew=async b=>{const r=await pool.query('INSERT INTO SUBSCRIPTION (member_id,plan_id,start_date,end_date) SELECT ?,plan_id,?,DATE_ADD(?,INTERVAL duration_months MONTH) FROM MEMBERSHIP_PLAN WHERE plan_id=?',[b.member_id,b.start_date,b.start_date,b.plan_id]);if(!r[0].affectedRows)bad('ไม่พบแพ็กเกจ')};
const book=(m,s)=>tx(async c=>{
 const[x]=await cq(c,'SELECT class_date,max_seats,TIMESTAMP(class_date,start_time)<NOW() past FROM CLASS_SCHEDULE WHERE schedule_id=? FOR UPDATE',[s]);
 if(!x)bad('ไม่พบรอบคลาส',404);if(x.past)bad('รอบนี้ผ่านไปแล้ว');
 const[cv]=await cq(c,'SELECT 1 x FROM SUBSCRIPTION WHERE member_id=? AND start_date<=? AND end_date>=? LIMIT 1',[m,x.class_date,x.class_date]);
 if(!cv)bad('แพ็กเกจของสมาชิกไม่ครอบคลุมวันที่เรียน');
 const[{n}]=await cq(c,"SELECT COUNT(*) n FROM CLASS_BOOKING WHERE schedule_id=? AND booking_status<>'CANCELLED'",[s]);
 const[ex]=await cq(c,'SELECT booking_status FROM CLASS_BOOKING WHERE member_id=? AND schedule_id=?',[m,s]);
 if(ex&&ex.booking_status!=='CANCELLED')bad('จองรอบนี้ไว้แล้ว');if(n>=x.max_seats)bad('ที่นั่งเต็มแล้ว');
 if(ex)await cq(c,"UPDATE CLASS_BOOKING SET booking_status='BOOKED',booking_datetime=NOW() WHERE member_id=? AND schedule_id=?",[m,s]);
 else await cq(c,'INSERT INTO CLASS_BOOKING (member_id,schedule_id) VALUES (?,?)',[m,s])});
const checkin=id=>tx(async c=>{
 const[m]=await cq(c,'SELECT first_name,last_name FROM MEMBER WHERE member_id=? FOR UPDATE',[id]);if(!m)bad('ไม่พบรหัสสมาชิก',404);
 const[s]=await cq(c,'SELECT MAX(end_date) end_date,MAX(end_date)>=CURDATE() ok FROM SUBSCRIPTION WHERE member_id=?',[id]);
 const[p]=await cq(c,'SELECT p.plan_name FROM SUBSCRIPTION s JOIN MEMBERSHIP_PLAN p USING(plan_id) WHERE s.member_id=? ORDER BY s.start_date DESC LIMIT 1',[id]);
 const o={name:m.first_name+' '+m.last_name,plan_name:p&&p.plan_name,end_date:s.end_date};
 if(!s.ok)return{ok:false,...o};
 await cq(c,'INSERT INTO CHECK_IN (member_id,check_in_no) SELECT ?,COALESCE(MAX(check_in_no),0)+1 FROM CHECK_IN WHERE member_id=?',[id,id]);
 const[r]=await cq(c,'SELECT check_in_no,check_in_time FROM CHECK_IN WHERE member_id=? ORDER BY check_in_no DESC LIMIT 1',[id]);
 return{ok:true,...o,...r}});
app.post('/api/gate',h(async(req,res)=>res.json(await checkin(String(req.body.member_id||'').trim().toUpperCase()))));
app.post('/api/book',need('user'),h(async(req,res)=>{await book(mid(req),req.body.schedule_id);res.json({})}));
app.post('/api/cancel',need('user'),h(async(req,res)=>{const[r]=await pool.query("UPDATE CLASS_BOOKING SET booking_status='CANCELLED' WHERE member_id=? AND schedule_id=? AND booking_status='BOOKED'",[mid(req),req.body.schedule_id]);if(!r.affectedRows)bad('ยกเลิกไม่ได้');res.json({})}));

app.get('/api/classes',need('user','trainer'),h(async(req,res)=>{const u=req.session.u,{from,to}=req.query,tid=u.role==='trainer'?u.id:req.query.trainer_id,w=[],p=[u.role==='user'?u.id:null];
 if(from){w.push('c.class_date BETWEEN ? AND ?');p.push(from,to)}if(tid){w.push('c.trainer_id=?');p.push(tid)}
 res.json(await q(`SELECT c.*,t.first_name tf,t.last_name tl,c.max_seats-(SELECT COUNT(*) FROM CLASS_BOOKING b WHERE b.schedule_id=c.schedule_id AND b.booking_status<>'CANCELLED') seats_remaining,(SELECT booking_status FROM CLASS_BOOKING b WHERE b.schedule_id=c.schedule_id AND b.member_id=?) my_status FROM CLASS_SCHEDULE c JOIN TRAINER t USING(trainer_id)${w.length?' WHERE '+w.join(' AND '):''} ORDER BY c.class_date,c.start_time`,p))}));
app.get('/api/trainer',need('trainer'),h(async(req,res)=>{const u=req.session.u,[t]=await q('SELECT first_name,last_name,specialty FROM TRAINER WHERE trainer_id=?',[u.role==='trainer'?u.id:req.query.trainer_id]);res.json(t||{})}));
const own=async(req,sid)=>{const u=req.session.u,[c]=await q('SELECT trainer_id,TIMESTAMP(class_date,start_time)>NOW() future FROM CLASS_SCHEDULE WHERE schedule_id=?',[sid]);if(!c||(u.role==='trainer'&&c.trainer_id!==u.id))bad('ไม่มีสิทธิ์',403);return c};
app.get('/api/roster',need('trainer'),h(async(req,res)=>{await own(req,req.query.schedule_id);
 res.json(await q('SELECT m.member_id,m.first_name,m.last_name,m.phone,b.booking_datetime,b.booking_status FROM CLASS_BOOKING b JOIN MEMBER m USING(member_id) WHERE b.schedule_id=? ORDER BY b.booking_datetime',[req.query.schedule_id]))}));
app.post('/api/attend',need('trainer'),h(async(req,res)=>{const{schedule_id:s,member_id:m,status}=req.body;
 if(!['ATTENDED','NO_SHOW'].includes(status))bad('สถานะไม่ถูกต้อง');if((await own(req,s)).future)bad('คลาสยังไม่เริ่ม เช็คชื่อไม่ได้');
 const[r]=await pool.query("UPDATE CLASS_BOOKING SET booking_status=? WHERE schedule_id=? AND member_id=? AND booking_status<>'CANCELLED'",[status,s,m]);if(!r.affectedRows)bad('ไม่พบการจอง');res.json({})}));

app.get('/api/profile',need('user'),h(async(req,res)=>{const id=mid(req),[m]=await q('SELECT member_id,first_name,last_name,phone,email,birth_date,join_date,TIMESTAMPDIFF(YEAR,birth_date,CURDATE()) age FROM MEMBER WHERE member_id=?',[id]);if(!m)bad('ไม่พบสมาชิก',404);
 const[a]=await q('SELECT MAX(end_date)>=CURDATE() ok FROM SUBSCRIPTION WHERE member_id=?',[id]);
 res.json({m,active:!!a.ok,
  subs:await q('SELECT s.start_date,s.end_date,p.plan_name,p.duration_months,p.price FROM SUBSCRIPTION s JOIN MEMBERSHIP_PLAN p USING(plan_id) WHERE s.member_id=? ORDER BY s.start_date DESC',[id]),
  checkins:await q('SELECT check_in_no,check_in_time FROM CHECK_IN WHERE member_id=? ORDER BY check_in_no DESC',[id]),
  bookings:await q('SELECT c.class_name,c.class_date,c.start_time,b.schedule_id,b.booking_datetime,b.booking_status FROM CLASS_BOOKING b JOIN CLASS_SCHEDULE c USING(schedule_id) WHERE b.member_id=? ORDER BY b.booking_datetime DESC',[id])})}));
app.post('/api/password',need('user'),h(async(req,res)=>{const{old_password:o,new_password:n}=req.body,id=req.session.u.id,[m]=await q('SELECT password FROM MEMBER WHERE member_id=?',[id]);
 if(!m||!(await bcrypt.compare(o||'',m.password)))bad('รหัสผ่านเดิมไม่ถูกต้อง');await q('UPDATE MEMBER SET password=? WHERE member_id=?',[await hash(n),id]);res.json({})}));

app.get('/api/dashboard',need(),h(async(_,res)=>{
 const act=s=>`(SELECT MAX(end_date) FROM SUBSCRIPTION s WHERE s.member_id=m.member_id)${s}`;
 res.json({
  members:await q(`SELECT m.member_id,m.first_name,m.last_name,TIMESTAMPDIFF(YEAR,m.birth_date,CURDATE()) age,(SELECT p.plan_name FROM SUBSCRIPTION s JOIN MEMBERSHIP_PLAN p USING(plan_id) WHERE s.member_id=m.member_id ORDER BY s.start_date DESC LIMIT 1) plan_name,${act(' end_date')},${act('>=CURDATE() active')},(SELECT COUNT(*) FROM CHECK_IN c WHERE c.member_id=m.member_id) check_ins,a.first_name af,a.last_name al FROM MEMBER m LEFT JOIN ADMIN a ON a.admin_id=m.admin_id ORDER BY m.member_id`),
  classes:await q("SELECT c.schedule_id,c.class_name,c.class_date,c.start_time,c.max_seats,c.max_seats-(SELECT COUNT(*) FROM CLASS_BOOKING b WHERE b.schedule_id=c.schedule_id AND b.booking_status<>'CANCELLED') seats_remaining FROM CLASS_SCHEDULE c WHERE c.class_date>=CURDATE() ORDER BY c.class_date,c.start_time"),
  recent:await q('SELECT c.member_id,m.first_name,m.last_name,c.check_in_no,c.check_in_time FROM CHECK_IN c JOIN MEMBER m USING(member_id) ORDER BY c.check_in_time DESC LIMIT 10'),
  confirmed:(await q("SELECT COUNT(*) n FROM CLASS_BOOKING WHERE booking_status IN ('BOOKED','ATTENDED')"))[0].n,
  checkins:(await q('SELECT COUNT(*) n FROM CHECK_IN'))[0].n})}));

const T={
 MEMBER:{pk:['member_id'],auto:['M',5],cols:['member_id','first_name','last_name','phone','email','birth_date','join_date','password','admin_id'],ins:['first_name','last_name','phone','email','birth_date','password','plan_id']},
 MEMBERSHIP_PLAN:{pk:['plan_id'],auto:['P',3],cols:['plan_id','plan_name','duration_months','price']},
 SUBSCRIPTION:{pk:['member_id','plan_id','start_date'],cols:['member_id','plan_id','start_date','end_date'],ins:['member_id','plan_id','start_date']},
 TRAINER:{pk:['trainer_id'],auto:['T',3],cols:['trainer_id','first_name','last_name','phone','specialty','username','password']},
 CLASS_SCHEDULE:{pk:['schedule_id'],auto:['S',5],cols:['schedule_id','class_name','class_date','start_time','end_time','room','max_seats','trainer_id']},
 CLASS_BOOKING:{pk:['member_id','schedule_id'],cols:['member_id','schedule_id','booking_datetime','booking_status'],ins:['member_id','schedule_id']},
 CHECK_IN:{pk:['member_id','check_in_no'],cols:['member_id','check_in_no','check_in_time'],ins:['member_id']},
 ADMIN:{pk:['admin_id'],auto:['A',3],cols:['admin_id','first_name','last_name','username','password']}};
const A=[need(),(req,res,n)=>{if(!Object.hasOwn(T,req.params.t))return res.status(404).json({error:'ไม่พบตาราง'});req.T=T[req.params.t];n()}];
const where=(d,k)=>{const v=k.split('|');return[d.pk.map(c=>c+'=?').join(' AND '),v]};
app.get('/api/meta',need(),(_,res)=>res.json(T));
app.get('/api/t/:t',A,h(async(req,res)=>res.json(await q(`SELECT ${req.T.cols.filter(c=>c!=='password')} FROM ${req.params.t} ORDER BY ${req.T.pk}`))));
app.post('/api/t/:t',A,h(async(req,res)=>{const t=req.params.t,b=req.body,d=req.T;
 if(t==='MEMBER')await register(b,req.session.u.id);
 else if(t==='SUBSCRIPTION')await renew(b);
 else if(t==='CLASS_BOOKING')await book(b.member_id,b.schedule_id);
 else if(t==='CHECK_IN'){if(!(await checkin(b.member_id)).ok)bad('สมาชิกหมดอายุ เช็คอินไม่ได้')}
 else await tx(async c=>{const k=d.cols.filter(x=>x!==d.pk[0]),id=await nextId(c,t,d.pk[0],...d.auto),v=[];
  for(const x of k)v.push(x==='password'?await hash(b[x]):b[x]===''?null:b[x]);
  await cq(c,`INSERT INTO ${t} (${[d.pk[0],...k]}) VALUES (?)`,[[id,...v]])});
 res.json({})}));
app.put('/api/t/:t/:k',A,h(async(req,res)=>{const t=req.params.t,d=req.T,b=req.body,set=[],v=[];
 for(const x of d.cols.filter(c=>!d.pk.includes(c))){if(x==='password'){if(!b[x])continue;v.push(await hash(b[x]))}else v.push(b[x]===''?null:b[x]);set.push(x+'=?')}
 if(t==='CLASS_SCHEDULE'){const[{n}]=await q("SELECT COUNT(*) n FROM CLASS_BOOKING WHERE schedule_id=? AND booking_status<>'CANCELLED'",[req.params.k]);if(n>Number(b.max_seats))bad('ที่นั่งน้อยกว่าจำนวนผู้จองปัจจุบัน')}
 const[w,k]=where(d,req.params.k);await q(`UPDATE ${t} SET ${set} WHERE ${w}`,[...v,...k]);res.json({})}));
app.delete('/api/t/:t/:k',A,h(async(req,res)=>{const t=req.params.t,d=req.T,[w,k]=where(d,req.params.k);
 if(t==='SUBSCRIPTION'&&(await q('SELECT COUNT(*) n FROM SUBSCRIPTION WHERE member_id=?',[k[0]]))[0].n<=1)bad('สมาชิกต้องมีประวัติแพ็กเกจอย่างน้อย 1 รายการ');
 if(t==='ADMIN'&&k[0]===req.session.u.id)bad('ลบบัญชีที่กำลังใช้งานอยู่ไม่ได้');
 await q(`DELETE FROM ${t} WHERE ${w}`,k);res.json({})}));
app.listen(E.PORT||3000,async()=>{console.log('เปิดที่ http://localhost:'+(E.PORT||3000));
 try{const[[r]]=await pool.query('SELECT COUNT(*) n FROM MEMBER');console.log('✔ เชื่อมต่อฐานข้อมูลสำเร็จ (สมาชิก '+r.n+' คน)')}
 catch(e){console.error('✘ เชื่อมต่อฐานข้อมูลไม่สำเร็จ: '+(DBERR[e.code]||e.message))}});
