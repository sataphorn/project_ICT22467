const mysql=require('mysql2/promise'),bcrypt=require('bcryptjs'),fs=require('fs'),path=require('path'),E=process.env;
const dt=(d=0,m=0)=>{const x=new Date();x.setMonth(x.getMonth()+m);x.setDate(x.getDate()+d);return x.toLocaleDateString('sv-SE')};
(async()=>{
const c=await mysql.createConnection({host:E.DB_HOST||'localhost',user:E.DB_USER||'root',password:E.DB_PASSWORD||'',multipleStatements:true});
await c.query('DROP DATABASE IF EXISTS fitclub_pro');
await c.query(fs.readFileSync([path.join(__dirname,'schema.sql'),path.join(__dirname,'db','schema.sql')].find(fs.existsSync),'utf8'));
const ins=(t,r)=>c.query(`INSERT INTO ${t} VALUES ?`,[r]);
const A=bcrypt.hashSync('admin1234',10),M=bcrypt.hashSync('pass1234',10),T=bcrypt.hashSync('tr1234',10);
await ins('ADMIN',[['A001','สุรชัย','ใจดี','admin_surachai',A],['A002','ปวีณา','ดูแลดี','admin_paweena',A]]);
await ins('MEMBERSHIP_PLAN',[['P001','Monthly Starter (1 เดือน)',1,1500],['P002','Quarterly Pro (3 เดือน)',3,3900],['P003','Annual Elite (12 เดือน)',12,12900]]);
await ins('MEMBER',[
['M00001','ธนวัฒน์','รัตนชัย','0812345678','thanawat@fitclub.th','1996-05-14',dt(0,-8),M,'A001'],
['M00002','ณัฐธิดา','วงศ์สุวรรณ','0898765432','natthida@fitclub.th','1999-11-22',dt(0,-1),M,null],
['M00003','ภูริพัฒน์','เจริญกิจ','0823456789','phuripat@fitclub.th','1992-08-03',dt(-40),M,'A001'],
['M00004','พิมพ์ชนก','ศิริวัฒน์','0865432109','pimchanok@fitclub.th','2001-02-19',dt(-12),M,'A002'],
['M00005','ศุภกร','กิตติไพศาล','0851122334','supakorn@fitclub.th','1988-09-30',dt(-5,-3),M,null]]);
await ins('SUBSCRIPTION',[['M00001','P002',dt(0,-8),dt(0,-5)],['M00001','P003',dt(0,-5),dt(0,7)],['M00002','P002',dt(0,-1),dt(0,2)],
['M00003','P001',dt(-40),dt(-10)],['M00004','P001',dt(-12),dt(18)],['M00005','P002',dt(-5,-3),dt(-5)]]);
await ins('TRAINER',[['T001','กฤตภาส','พลังไชย','0911112222','HIIT & Functional','trainer_krit',T],
['T002','อัญชลี','สุขสันต์','0922223333','Vinyasa Yoga & Pilates','trainer_anchalee',T],['T003','ภาคิน','แสนกล้า','0933334444','Muay Thai & Boxing','trainer_pakin',T]]);
await ins('CLASS_SCHEDULE',[['S00001','HIIT Burn Express',dt(-1),'09:00:00','10:00:00','Studio A',12,'T001'],
['S00002','Morning Flow Yoga',dt(1),'10:30:00','11:30:00','Zen Room',15,'T002'],['S00003','Muay Thai Fit',dt(2),'17:30:00','18:30:00','Combat Zone',10,'T003'],
['S00004','Core & Strength',dt(3),'18:00:00','19:00:00','Studio A',2,'T001'],['S00005','Core Pilates',dt(4),'14:00:00','15:00:00','Zen Room',12,'T002'],
['S00006','Cardio Boxing',dt(9),'17:00:00','18:00:00','Combat Zone',10,'T003']]);
await ins('CLASS_BOOKING',[['M00001','S00001',dt(-2)+' 14:20:00','BOOKED'],['M00002','S00001',dt(-1)+' 09:15:00','ATTENDED'],['M00004','S00001',dt(-1)+' 11:05:00','NO_SHOW'],
['M00001','S00004',dt()+' 08:30:00','BOOKED'],['M00002','S00004',dt()+' 08:45:00','BOOKED']]);
await ins('CHECK_IN',[['M00001',1,dt(-3)+' 08:12:10'],['M00001',2,dt(-1)+' 17:40:05'],['M00002',1,dt()+' 09:02:44']]);
console.log('seed เสร็จแล้ว');await c.end()})().catch(e=>{console.error(e.message);process.exit(1)});
