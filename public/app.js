const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
const LBL={member_id:'รหัสสมาชิก',first_name:'ชื่อ',last_name:'นามสกุล',phone:'เบอร์โทร',email:'อีเมล',birth_date:'วันเกิด',join_date:'วันที่สมัคร',password:'รหัสผ่าน',admin_id:'ผู้รับสมัคร',plan_id:'แพ็กเกจ',plan_name:'แพ็กเกจ',duration_months:'ระยะเวลา (เดือน)',price:'ราคา (บาท)',trainer_id:'เทรนเนอร์',specialty:'ความเชี่ยวชาญ',username:'ชื่อผู้ใช้',schedule_id:'รอบคลาส',class_name:'ชื่อคลาส',class_date:'วันที่',start_time:'เริ่ม',end_time:'จบ',room:'ห้อง',max_seats:'ที่นั่งสูงสุด',start_date:'วันเริ่ม',end_date:'วันหมดอายุ',booking_datetime:'เวลาที่จอง',booking_status:'สถานะ',check_in_no:'ครั้งที่',check_in_time:'เวลาเช็คอิน',seats_remaining:'ที่นั่งว่าง',age:'อายุ'};
const TN={MEMBER:'สมาชิก',MEMBERSHIP_PLAN:'แพ็กเกจ',SUBSCRIPTION:'การสมัครแพ็กเกจ',TRAINER:'เทรนเนอร์',CLASS_SCHEDULE:'รอบคลาส',CLASS_BOOKING:'การจอง',CHECK_IN:'เช็คอิน',ADMIN:'ผู้ดูแล'};
const FK={member_id:['MEMBER',r=>r.first_name+' '+r.last_name],plan_id:['MEMBERSHIP_PLAN',r=>r.plan_name],trainer_id:['TRAINER',r=>r.first_name+' '+r.last_name],admin_id:['ADMIN',r=>r.first_name+' '+r.last_name],schedule_id:['CLASS_SCHEDULE',r=>r.class_name+' '+r.class_date]};
const NAVS={guest:[['login','เข้าสู่ระบบ'],['register','สมัครสมาชิก'],['gate','เช็คอินหน้าประตู']],user:[['schedule','ตารางคลาส'],['profile','โปรไฟล์'],['gate','เช็คอินหน้าประตู']],trainer:[['trainer','รายงานคลาส'],['schedule','ตารางคลาส']],admin:[['dashboard','แดชบอร์ด'],['schedule','ตารางคลาส'],['trainer','รายงานเทรนเนอร์'],['data','จัดการข้อมูล'],['gate','เช็คอินหน้าประตู']]};
const K=c=>`${LBL[c]||c}<i class="c">${c}</i>`,iso=d=>d.toLocaleDateString('sv-SE'),addd=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const mon=o=>addd(new Date(),-((new Date().getDay()+6)%7)+o*7),hm=s=>String(s).slice(0,5);
const fd=s=>s?new Date(String(s).slice(0,10)+'T00:00').toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'}):'-';
const tag=s=>`<span class="tag ${/^(ACTIVE|ATTENDED)$/.test(s)?'ok':/^(EXPIRED|NO_SHOW|CANCELLED)$/.test(s)?'no':''}">${s}</span>`;
const tbl=(h,rows)=>`<div class="wrap"><table><tr>${h.map(x=>`<th>${x}</th>`).join('')}</tr>${rows.map(r=>`<tr>${r.map(x=>`<td>${x}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${h.length}">ไม่มีข้อมูล</td></tr>`}</table></div>`;
let U=null,META=null,wk=0,flt='',tid='',sid='',tab='MEMBER',edit=null,ROWS=[];
const api=async(u,m='GET',b)=>{const r=await fetch('/api/'+u,{method:m,headers:{'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined}),d=await r.json().catch(()=>({}));
 if(!r.ok){if(r.status===401&&U){U=null;render()}throw new Error(d.error||'เกิดข้อผิดพลาด')}return d};
const toast=(m,e)=>{const t=$('#toast');t.textContent=m;t.className=e?'e show':'show';setTimeout(()=>t.className='',e?6000:3000)};
const run=async f=>{try{await f()}catch(e){toast(e.message,1)}};
const go=h=>location.hash==='#'+h?render():location.hash=h;
const V={},ACT={},FORM={},CH={flt:v=>{flt=v;render()},tid:v=>{tid=v;render()},sid:v=>{sid=v;render()}};

V.login=async()=>`<form data-f="login" class="card narrow"><div class="tabs">${[['user','สมาชิก'],['trainer','เทรนเนอร์'],['admin','ผู้ดูแลระบบ']].map(([v,t],i)=>`<label><input type="radio" name="role" value="${v}" ${i?'':'checked'}>${t}</label>`).join('')}</div>
<label>อีเมล / ชื่อผู้ใช้<i class="c">email · username</i></label><input name="ident" required><label>${K('password')}</label><input name="password" type="password" required><p><button>เข้าสู่ระบบ</button></p></form>`;
FORM.login=async d=>{U=await api('login','POST',d);go(U.role==='trainer'?'/trainer':U.role==='admin'?'/dashboard':'/schedule')};

V.register=async()=>{const p=await api('plans');return `<form data-f="register" class="card narrow">${['first_name','last_name','phone','email','birth_date','password'].map(c=>`<label>${K(c)}</label><input name="${c}" type="${c==='email'?'email':c==='birth_date'?'date':c==='password'?'password':'text'}" ${c==='phone'?'maxlength="10" pattern="\\d{10}"':''} ${c==='password'?'minlength="6"':''} required>`).join('')}
<label>${K('plan_id')}</label><select name="plan_id">${p.map(x=>`<option value="${x.plan_id}">${esc(x.plan_name)} · ${x.duration_months} เดือน · ฿${Number(x.price).toLocaleString()}</option>`).join('')}</select><p><button>สมัครสมาชิก</button></p></form>`};
FORM.register=async d=>{await api('register','POST',d);U=await api('login','POST',{role:'user',ident:d.email,password:d.password});toast('สมัครสมาชิกสำเร็จ');go('/schedule')};

V.gate=async()=>`<form data-f="gate" class="card narrow"><label>${K('member_id')}</label><input name="member_id" maxlength="6" placeholder="M00001" required autofocus><p><button>เช็คอิน</button></p><div id="gateOut"></div></form>`;
FORM.gate=async d=>{const r=await api('gate','POST',d);$('#gateOut').innerHTML=`<div class="res ${r.ok?'ok':'no'}"><h2>${r.ok?'เช็คอินสำเร็จ':'สมาชิกหมดอายุ เข้าไม่ได้'}</h2><p>${esc(r.name)}</p><p>${K('plan_name')}: ${esc(r.plan_name)} · ${K('end_date')}: ${fd(r.end_date)}</p>${r.ok?`<p>${K('check_in_no')} #${r.check_in_no} · ${K('check_in_time')} ${esc(r.check_in_time)}</p>`:''}</div>`};

V.schedule=async()=>{const m=mon(wk),all=await api(`classes?from=${iso(m)}&to=${iso(addd(m,6))}`),names=[...new Set(all.map(c=>c.class_name))];if(!names.includes(flt))flt='';
 const now=new Date().toLocaleString('sv-SE'),cl=all.filter(c=>!flt||c.class_name===flt);
 return `<div class="row"><button class="g" data-a="wk" data-d="-1">◀</button><button class="g" data-a="wk" data-d="0">สัปดาห์นี้</button><button class="g" data-a="wk" data-d="1">▶</button><b>${fd(iso(m))} – ${fd(iso(addd(m,6)))}</b>
 <select data-c="flt"><option value="">ทุกคลาส</option>${names.map(n=>`<option ${n===flt?'selected':''}>${esc(n)}</option>`).join('')}</select></div>
 <div class="grid">${cl.map(c=>{const s=c.my_status,mine=s&&s!=='CANCELLED';let b='';
  if(U.role==='user')b=mine?(s==='BOOKED'?`<button class="r" data-a="cancel" data-id="${c.schedule_id}">ยกเลิกการจอง</button>`:tag(s)):c.class_date+' '+c.start_time<now?'<button disabled>ผ่านไปแล้ว</button>':c.seats_remaining<=0?'<button disabled>เต็ม</button>':`<button data-a="book" data-id="${c.schedule_id}">จองคลาส</button>`;
  return `<div class="card"><h3>${esc(c.class_name)}<i class="c">class_name</i></h3><div>${fd(c.class_date)} · ${hm(c.start_time)}–${hm(c.end_time)}<i class="c">class_date, start_time, end_time</i></div><div>ห้อง ${esc(c.room)}<i class="c">room</i> · ${esc(c.tf+' '+c.tl)}<i class="c">trainer_id</i></div><p>${K('seats_remaining')} <b>${c.seats_remaining}/${c.max_seats}</b><i class="c">max_seats</i></p>${b}</div>`}).join('')||'<div class="card">ไม่มีคลาสในสัปดาห์นี้</div>'}</div>`};
ACT.wk=b=>{wk=b.dataset.d==='0'?0:wk+Number(b.dataset.d);render()};
ACT.book=async b=>{await api('book','POST',{schedule_id:b.dataset.id});toast('จองสำเร็จ');render()};
ACT.cancel=async b=>{await api('cancel','POST',{schedule_id:b.dataset.id});toast('ยกเลิกการจองแล้ว');render()};

V.profile=async id=>{const r=await api('profile'+(id?'?member_id='+id:'')),m=r.m;
 return `<div class="card"><h2>${esc(m.first_name+' '+m.last_name)} ${tag(r.active?'ACTIVE':'EXPIRED')}</h2><div class="grid">${[['member_id',m.member_id],['phone',m.phone],['email',esc(m.email)],['birth_date',fd(m.birth_date)+` (${m.age} ปี)`],['join_date',fd(m.join_date)]].map(([k,v])=>`<div>${K(k)}<br><b>${v}</b></div>`).join('')}</div></div>
 <div class="card"><h3>แพ็กเกจ</h3>${tbl([K('plan_name'),K('duration_months'),K('price'),K('start_date'),K('end_date')],r.subs.map(s=>[esc(s.plan_name),s.duration_months,Number(s.price).toLocaleString(),fd(s.start_date),fd(s.end_date)]))}</div>
 <div class="card"><h3>การจองคลาส</h3>${tbl([K('class_name'),K('class_date'),K('start_time'),K('booking_datetime'),K('booking_status'),''],r.bookings.map(b=>[esc(b.class_name),fd(b.class_date),hm(b.start_time),esc(b.booking_datetime),tag(b.booking_status),U.role==='user'&&b.booking_status==='BOOKED'?`<button class="r" data-a="cancel" data-id="${b.schedule_id}">ยกเลิก</button>`:'']))}</div>
 <div class="card"><h3>ประวัติเช็คอิน</h3>${tbl([K('check_in_no'),K('check_in_time')],r.checkins.map(c=>[c.check_in_no,esc(c.check_in_time)]))}</div>
 ${U.role==='user'?`<form class="card narrow" data-f="pw"><h3>เปลี่ยนรหัสผ่าน</h3><label>รหัสผ่านเดิม</label><input type="password" name="old_password" required><label>${K('password')} ใหม่</label><input type="password" name="new_password" minlength="6" required><p><button>บันทึก</button></p></form>`:''}`};
FORM.pw=async(d,f)=>{await api('password','POST',d);f.reset();toast('เปลี่ยนรหัสผ่านแล้ว')};

V.trainer=async()=>{const ad=U.role==='admin';let sel='';
 if(ad){const ts=await api('t/TRAINER');tid=ts.some(t=>t.trainer_id===tid)?tid:ts[0]?.trainer_id||'';sel=`<select data-c="tid">${ts.map(t=>`<option value="${t.trainer_id}" ${t.trainer_id===tid?'selected':''}>${esc(t.first_name+' '+t.last_name)}</option>`).join('')}</select>`}
 const[t,cl]=await Promise.all([api('trainer'+(ad?'?trainer_id='+tid:'')),api('classes'+(ad?'?trainer_id='+tid:''))]);
 if(!cl.some(x=>x.schedule_id===sid))sid=cl[0]?.schedule_id||'';const c=cl.find(x=>x.schedule_id===sid),ro=c?await api('roster?schedule_id='+sid):[];
 return `<div class="row">${sel}<b>${esc((t.first_name||'')+' '+(t.last_name||''))}</b> · ${K('specialty')}: ${esc(t.specialty)}</div>
 <div class="row"><select data-c="sid">${cl.map(x=>`<option value="${x.schedule_id}" ${x.schedule_id===sid?'selected':''}>${esc(x.class_name)} · ${fd(x.class_date)} ${hm(x.start_time)}</option>`).join('')}</select></div>
 ${c?`<div class="card"><h3>${esc(c.class_name)}</h3><p>${fd(c.class_date)} ${hm(c.start_time)}–${hm(c.end_time)} · ห้อง ${esc(c.room)} · ${K('max_seats')}: ${c.max_seats} · ${K('seats_remaining')}: ${c.seats_remaining}</p>
 ${tbl([K('member_id'),'ชื่อ-นามสกุล',K('phone'),K('booking_datetime'),K('booking_status'),'เช็คชื่อ'],ro.map(r=>[r.member_id,esc(r.first_name+' '+r.last_name),r.phone,esc(r.booking_datetime),tag(r.booking_status),r.booking_status==='CANCELLED'?'':`<button data-a="att" data-m="${r.member_id}" data-s="ATTENDED">มา</button> <button class="r" data-a="att" data-m="${r.member_id}" data-s="NO_SHOW">ไม่มา</button>`]))}</div>`:'<div class="card">ไม่มีรอบคลาส</div>'}`};
ACT.att=async b=>{await api('attend','POST',{schedule_id:sid,member_id:b.dataset.m,status:b.dataset.s});toast('บันทึกแล้ว');render()};

V.dashboard=async()=>{const d=await api('dashboard'),a=d.members.filter(m=>m.active).length;
 return `<div class="kpi">${[['สมาชิก ACTIVE',a],['สมาชิก EXPIRED',d.members.length-a],['การจองที่ยืนยัน',d.confirmed],['เช็คอินทั้งหมด',d.checkins]].map(([t,n])=>`<div class="card"><b>${n}</b>${t}</div>`).join('')}</div>
 <div class="card"><h3>สมาชิก</h3>${tbl([K('member_id'),'ชื่อ-นามสกุล',K('age'),K('plan_name'),K('end_date'),'สถานะ','เช็คอิน (ครั้ง)',K('admin_id')],d.members.map(m=>[`<a href="#/profile/${m.member_id}">${m.member_id}</a>`,esc(m.first_name+' '+m.last_name),m.age,esc(m.plan_name),fd(m.end_date),tag(m.active?'ACTIVE':'EXPIRED'),m.check_ins,m.af?esc(m.af+' '+m.al):'สมัครเอง']))}</div>
 <div class="card"><h3>รอบคลาสที่กำลังจะมาถึง</h3>${tbl([K('schedule_id'),K('class_name'),K('class_date'),K('start_time'),K('max_seats'),K('seats_remaining')],d.classes.map(c=>[c.schedule_id,esc(c.class_name),fd(c.class_date),hm(c.start_time),c.max_seats,c.seats_remaining]))}</div>
 <div class="card"><h3>เช็คอินล่าสุด</h3>${tbl([K('member_id'),'ชื่อ-นามสกุล',K('check_in_no'),K('check_in_time')],d.recent.map(r=>[r.member_id,esc(r.first_name+' '+r.last_name),r.check_in_no,esc(r.check_in_time)]))}</div>`};

const IT=c=>/_date$/.test(c)?'date':/_time$/.test(c)&&c!=='check_in_time'?'time':c==='password'?'password':['duration_months','price','max_seats'].includes(c)?'number':'text';
const key=(d,r)=>d.pk.map(c=>r[c]).join('|');
V.data=async()=>{META=META||await api('meta');const d=META[tab],rows=ROWS=await api('t/'+tab),ed=edit?rows.find(r=>key(d,r)===edit):null;
 const fields=ed?d.cols.filter(c=>!d.pk.includes(c)):d.ins||d.cols.filter(c=>!(d.auto&&c===d.pk[0])),opts={};
 await Promise.all(fields.filter(c=>FK[c]).map(async c=>opts[c]=await api('t/'+FK[c][0])));
 const inp=c=>{const v=ed?ed[c]??'':'',n=`name="${c}"`;
  if(FK[c]){const pk=META[FK[c][0]].pk[0];return `<select ${n}>${c==='admin_id'?'<option value="">— ไม่มี —</option>':''}${opts[c].map(r=>`<option value="${r[pk]}" ${r[pk]===v?'selected':''}>${esc(r[pk]+' — '+FK[c][1](r))}</option>`).join('')}</select>`}
  if(c==='booking_status')return `<select ${n}>${['BOOKED','CANCELLED','ATTENDED','NO_SHOW'].map(s=>`<option ${s===v?'selected':''}>${s}</option>`).join('')}</select>`;
  return `<input ${n} type="${IT(c)}" value="${esc(v)}" ${IT(c)==='number'?'step="any"':''} ${c==='phone'?'maxlength="10" pattern="\\d{10}"':''} ${c==='password'&&ed?'placeholder="เว้นว่าง = ไม่เปลี่ยน"':'required'}>`};
 const cols=d.cols.filter(c=>c!=='password');
 return `<div class="row">${Object.keys(TN).map(t=>`<button class="${t===tab?'':'g'}" data-a="tab" data-t="${t}">${TN[t]}<i class="c">${t}</i></button>`).join('')}</div>
 <form class="card" data-f="row"><h3>${ed?'แก้ไข':'เพิ่มข้อมูล'}: ${TN[tab]}</h3>${ed?`<p>${d.pk.map(c=>`${K(c)}: <b>${esc(ed[c])}</b>`).join(' · ')}</p>`:''}<div class="grid">${fields.map(c=>`<div><label>${K(c)}</label>${inp(c)}</div>`).join('')}</div><p><button>บันทึก</button> ${ed?'<button type="button" class="g" data-a="noedit">ยกเลิก</button>':''}</p></form>
 <div class="card">${tbl([...cols.map(K),''],rows.map(r=>[...cols.map(c=>esc(r[c])),`<button class="g" data-a="edit" data-k="${esc(key(d,r))}">แก้ไข</button> <button class="r" data-a="del" data-k="${esc(key(d,r))}">ลบ</button>`]))}</div>`};
ACT.tab=b=>{tab=b.dataset.t;edit=null;render()};ACT.edit=b=>{edit=b.dataset.k;render()};ACT.noedit=()=>{edit=null;render()};
ACT.del=async b=>{if(!confirm('ลบข้อมูลนี้?'))return;await api(`t/${tab}/${encodeURIComponent(b.dataset.k)}`,'DELETE');toast('ลบแล้ว');render()};
FORM.row=async d=>{await api(edit?`t/${tab}/${encodeURIComponent(edit)}`:'t/'+tab,edit?'PUT':'POST',d);toast('บันทึกแล้ว');edit=null;render()};
ACT.logout=async()=>{await api('logout','POST');U=null;go('/login')};

async function render(){const role=U?U.role:'guest',ns=NAVS[role];let[r,a]=location.hash.slice(2).split('/');
 if(!ns.some(n=>n[0]===r)&&!(r==='profile'&&role==='admin')){r=ns[0][0];a='';history.replaceState(null,'','#/'+r)}
 $('#nav').innerHTML=ns.map(n=>`<a href="#/${n[0]}" class="${n[0]===r?'on':''}">${n[1]}</a>`).join('');
 $('#who').innerHTML=U?`${esc(U.name)} <button class="g" data-a="logout">ออกจากระบบ</button>`:'';
 try{$('#app').innerHTML=await V[r](a)}catch(e){$('#app').innerHTML=`<div class="card narrow"><h3 class="err">เกิดข้อผิดพลาด</h3><p class="err">${esc(e.message)}</p></div>`}}
document.addEventListener('click',e=>{const b=e.target.closest('[data-a]');if(b)run(()=>ACT[b.dataset.a](b))});
document.addEventListener('submit',e=>{const f=e.target.closest('[data-f]');if(!f)return;e.preventDefault();run(()=>FORM[f.dataset.f](Object.fromEntries(new FormData(f)),f))});
document.addEventListener('change',e=>{const c=e.target.dataset.c;if(c)CH[c](e.target.value)});
$('#dbBtn').onclick=()=>document.body.classList.toggle('db');
window.addEventListener('hashchange',render);
api('me').catch(()=>null).then(u=>{U=u;render()});
