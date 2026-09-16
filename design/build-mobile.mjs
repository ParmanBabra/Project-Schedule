import { writeFileSync } from 'node:fs';

const tasks = [
  { n: 1, name: 'รวบรวมความต้องการ', s: 0, e: 2, crit: true, pg: 100, who: ['ส'] },
  { n: 2, name: 'ออกแบบระบบ', s: 3, e: 9, crit: true, pg: 40, who: ['ด'] },
  { n: 3, name: 'ออกแบบ UI', s: 3, e: 8, crit: false, pg: 25, who: ['ด'] },
  { n: 4, name: 'พัฒนา Backend', s: 10, e: 17, crit: true, pg: 0, who: ['ว'] },
  { n: 5, name: 'พัฒนา Frontend', s: 9, e: 15, crit: false, pg: 0, who: ['ด'] },
  { n: 6, name: 'ทดสอบระบบ', s: 18, e: 22, crit: true, pg: 0, who: ['ส', 'ว'] },
];
const who = { ส: '#6a4fd8', ด: '#e0457b', ว: '#1f9e89' };
const icon = (p, s = 24) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const I = {
  gantt: (s) => icon('<path d="M4 6h8"></path><path d="M9 12h9"></path><path d="M6 18h7"></path>', s),
  cal: (s) => icon('<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M3 10h18"></path><path d="M8 3v4"></path><path d="M16 3v4"></path>', s),
  res: (s) => icon('<circle cx="9" cy="8" r="3.5"></circle><path d="M2.5 20a6.5 6.5 0 0 1 13 0"></path><path d="M16 4.5a3.5 3.5 0 0 1 0 7"></path><path d="M17.5 14a6 6 0 0 1 4 6"></path>', s),
  plus: (s) => icon('<path d="M12 5v14"></path><path d="M5 12h14"></path>', s),
  more: (s) => icon('<circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"></circle><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"></circle><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"></circle>', s),
  chev: (s) => icon('<path d="M6 9l6 6 6-6"></path>', s),
  left: (s) => icon('<path d="M15 6l-6 6 6 6"></path>', s),
  right: (s) => icon('<path d="M9 6l6 6-6 6"></path>', s),
  x: (s) => icon('<path d="M6 6l12 12"></path><path d="M18 6L6 18"></path>', s),
  warn: (s) => icon('<path d="M12 3l10 18H2z"></path><path d="M12 10v5"></path><path d="M12 18h.01"></path>', s),
  today: (s) => icon('<circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none"></circle>', s),
};

const css = `
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Kanit", "Segoe UI", Tahoma, sans-serif; color: #2f2a4a; background: #f2f0fa; font-size: 13px; }
    a { color: #6a4fd8; } a:hover { color: #4e37b0; }
    .phone { width: 390px; height: 844px; background: #f2f0fa; position: relative; overflow: hidden; display: flex; flex-direction: column; }
    .hdr { height: 52px; margin: 12px 12px 0; background: #6a4fd8; border-radius: 16px; display: flex; align-items: center; gap: 10px; padding: 0 12px 0 14px; color: #ffffff; flex-shrink: 0; }
    .mark { width: 26px; height: 26px; border-radius: 8px; background: #ffd166; flex-shrink: 0; }
    .pname { flex: 1; display: flex; align-items: center; gap: 6px; font-weight: 500; font-size: 15px; min-width: 0; } .pname span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .hbtn { width: 36px; height: 36px; border-radius: 999px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.14); }
    .bar { display: flex; align-items: center; gap: 8px; padding: 10px 12px 0; flex-shrink: 0; }
    .seg { display: flex; background: #ffffff; border-radius: 999px; padding: 4px; height: 40px; box-shadow: 0 1px 2px rgba(47,42,74,0.06); } .seg span { display: flex; align-items: center; padding: 0 14px; border-radius: 999px; color: #6f6893; } .seg span.on { background: #6a4fd8; color: #ffffff; font-weight: 500; }
    .chip { height: 30px; padding: 0 12px; border-radius: 999px; font-size: 12px; font-weight: 500; background: #ffe0ec; color: #b8285a; display: inline-flex; align-items: center; gap: 6px; } .chip.soft { background: #ffffff; color: #6f6893; } .chip.on { background: #6a4fd8; color: #ffffff; }
    .card { margin: 10px 12px 0; background: #ffffff; border-radius: 18px; box-shadow: 0 2px 8px rgba(47,42,74,0.06); overflow: hidden; flex: 1; min-height: 0; display: flex; }
    .namecol { width: 120px; flex-shrink: 0; border-right: 1px solid #ece9f6; }
    .nc { height: 40px; display: flex; align-items: center; gap: 6px; padding: 0 8px 0 12px; border-bottom: 1px solid #f1eff8; font-size: 12px; line-height: 1.2; } .nc.head { height: 48px; font-size: 11px; color: #8a83a8; font-weight: 500; } .nc span.t { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .dot { width: 8px; height: 8px; border-radius: 999px; background: #8fd3c7; flex-shrink: 0; } .dot.crit { background: #e0457b; } .dot.ms { background: #ffd166; border-radius: 2px; transform: rotate(45deg); }
    .tl { flex: 1; position: relative; overflow: hidden; }
    .days { display: flex; height: 48px; border-bottom: 1px solid #ece9f6; } .wk { display: flex; flex-direction: column; flex-shrink: 0; border-right: 1px solid #ece9f6; } .wk-name { height: 22px; display: flex; align-items: center; padding: 0 6px; font-size: 11px; font-weight: 500; color: #4e37b0; white-space: nowrap; } .wk-days { display: flex; } .d { height: 26px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #8a83a8; } .d.we { color: #c9c4e0; }
    .rows { position: relative; } .grid-row { height: 40px; border-bottom: 1px solid #f1eff8; } .we-col { position: absolute; top: 0; bottom: 0; background: #f7f5fc; }
    .tb { position: absolute; height: 24px; border-radius: 999px; background: #8fd3c7; overflow: hidden; } .tb.crit { background: #e0457b; } .tb .pg { position: absolute; left: 0; top: 0; bottom: 0; background: rgba(0,0,0,0.12); }
    .tb.sel { box-shadow: 0 0 0 2px #ffffff, 0 0 0 4px #6a4fd8; }
    .ms { position: absolute; width: 14px; height: 14px; background: #ffd166; border-radius: 3px; transform: rotate(45deg); }
    .today { position: absolute; top: 0; bottom: 0; width: 2px; background: #6a4fd8; }
    .fab-today { position: absolute; right: 20px; bottom: 96px; width: 44px; height: 44px; border-radius: 999px; background: #ffffff; box-shadow: 0 6px 16px rgba(47,42,74,0.18); display: flex; align-items: center; justify-content: center; color: #6a4fd8; }
    .bnav { height: 76px; flex-shrink: 0; background: #ffffff; border-radius: 24px 24px 0 0; box-shadow: 0 -4px 24px rgba(47,42,74,0.08); display: flex; align-items: flex-start; justify-content: space-around; padding: 10px 8px 0; position: relative; }
    .bn { display: flex; flex-direction: column; align-items: center; gap: 2px; width: 72px; color: #8a83a8; font-size: 11px; } .bn.on { color: #6a4fd8; font-weight: 500; }
    .fab { width: 56px; height: 56px; border-radius: 999px; background: #2f2a4a; color: #ffffff; display: flex; align-items: center; justify-content: center; margin-top: -26px; box-shadow: 0 6px 16px rgba(47,42,74,0.24); }
    .foot { position: absolute; left: 0; right: 0; bottom: 0; }
    /* sheet */
    .dim { position: absolute; inset: 0; background: rgba(47,42,74,0.35); }
    .sheet { position: absolute; left: 0; right: 0; bottom: 0; height: 620px; background: #ffffff; border-radius: 24px 24px 0 0; box-shadow: 0 -4px 24px rgba(47,42,74,0.14); padding: 8px 16px 0; display: flex; flex-direction: column; gap: 12px; }
    .handle { width: 36px; height: 4px; border-radius: 999px; background: #d6d1ea; margin: 0 auto 4px; }
    .sh-head { display: flex; align-items: flex-start; justify-content: space-between; } .crumb { font-size: 12px; color: #8a83a8; } h2 { margin: 0; font-size: 18px; font-weight: 600; }
    .iconbtn { width: 36px; height: 36px; border-radius: 999px; background: #f2f0fa; display: flex; align-items: center; justify-content: center; color: #6f6893; }
    .frow { display: flex; gap: 10px; } .frow .field { flex: 1; } .field { display: flex; flex-direction: column; gap: 6px; } .label { font-size: 12px; color: #8a83a8; font-weight: 500; }
    .input { height: 44px; border-radius: 12px; background: #f2f0fa; padding: 0 12px; display: flex; align-items: center; justify-content: space-between; font-size: 14px; } .input.ro { color: #6f6893; }
    .dep { display: flex; align-items: center; gap: 8px; height: 44px; border-radius: 12px; background: #f2f0fa; padding: 0 12px; } .dep-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .dep.add { background: transparent; border: 2px dashed #d6d1ea; color: #8a83a8; justify-content: center; }
    .pill { height: 26px; padding: 0 10px; border-radius: 999px; background: #6a4fd8; color: #ffffff; font-size: 11px; font-weight: 500; display: inline-flex; align-items: center; } .pill.soft { background: #e6e1fb; color: #4e37b0; }
    .asg { position: absolute; display: inline-flex; align-items: center; } .asg-av { width: 22px; height: 22px; box-shadow: 0 0 0 2px #ffffff; } .asg-av + .asg-av { margin-left: -6px; } .asg-av.over { box-shadow: 0 0 0 2px #ffffff, 0 0 0 4px #e0457b; }
    .av { width: 24px; height: 24px; border-radius: 999px; color: #ffffff; font-size: 11px; font-weight: 500; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .cpm { border-radius: 14px; background: #ffe0ec; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; } .cpm-title { font-size: 12px; font-weight: 500; color: #b8285a; }
    .cpm-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; } .cpm-grid div { display: flex; flex-direction: column; } .cpm-grid span { font-size: 11px; color: #b8285a; } .cpm-grid b { font-size: 12px; font-weight: 600; }
    .save { height: 48px; border-radius: 999px; background: #2f2a4a; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 500; font-size: 15px; box-shadow: 0 6px 16px rgba(47,42,74,0.18); margin-top: auto; margin-bottom: 20px; }
    /* calendar */
    .avrow { display: flex; gap: 8px; padding: 10px 12px 0; overflow: hidden; flex-shrink: 0; } .avchip { height: 36px; padding: 0 12px 0 6px; border-radius: 999px; background: #ffffff; display: flex; align-items: center; gap: 6px; font-size: 12px; color: #6f6893; flex-shrink: 0; } .avchip.on { background: #6a4fd8; color: #ffffff; }
    .wknav { display: flex; align-items: center; gap: 8px; padding: 12px 12px 0; flex-shrink: 0; } .wknav h3 { margin: 0; flex: 1; text-align: center; font-size: 14px; font-weight: 600; }
    .clist { margin: 10px 12px 0; display: flex; flex-direction: column; gap: 8px; flex: 1; min-height: 0; overflow: hidden; }
    .day { background: #ffffff; border-radius: 16px; display: flex; gap: 10px; padding: 10px 12px; box-shadow: 0 2px 8px rgba(47,42,74,0.06); } .day.over { background: #ffe0ec; } .day.we { background: transparent; box-shadow: none; }
    .dn { width: 40px; display: flex; flex-direction: column; align-items: center; flex-shrink: 0; } .dn b { font-size: 18px; font-weight: 600; line-height: 1.1; } .dn span { font-size: 11px; color: #8a83a8; } .day.today .dn b { color: #6a4fd8; }
    .dtasks { flex: 1; display: flex; flex-direction: column; gap: 6px; min-width: 0; } .tchip { height: 30px; border-radius: 999px; background: #8fd3c7; color: #1f4d45; display: flex; align-items: center; padding: 0 12px; font-size: 12px; font-weight: 500; white-space: nowrap; overflow: hidden; } .tchip.crit { background: #e0457b; color: #ffffff; }
    .pct { align-self: center; font-size: 12px; font-weight: 600; color: #b8285a; display: flex; align-items: center; gap: 4px; } .free { font-size: 12px; color: #c9c4e0; align-self: center; }
`;

const wrap = (body) => `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;500;600&amp;display=swap">
  <style>${css}</style>
</helmet>
${body}
</x-dc>
</body>
</html>
`;

const hdr = `<div class="hdr"><div class="mark"></div><div class="pname"><span>ระบบจองห้องประชุม</span>${I.chev(16)}</div><div class="hbtn">${I.more(20)}</div></div>`;
const bnav = (on) => `<div class="bnav"><div class="bn${on === 'gantt' ? ' on' : ''}">${I.gantt(24)}<span>Gantt</span></div><div class="fab">${I.plus(26)}</div><div class="bn${on === 'cal' ? ' on' : ''}">${I.cal(24)}<span>ปฏิทิน</span></div><div class="bn${on === 'res' ? ' on' : ''}">${I.res(24)}<span>ทรัพยากร</span></div></div>`;

function ganttMobile(selected = null) {
  const DAY = 28, ROW = 40;
  const weeks = [{ name: '14 – 20 ก.ย.', days: [14, 15, 16, 17, 18, 19, 20] }, { name: '21 – 27 ก.ย.', days: [21, 22, 23, 24, 25, 26, 27] }, { name: '28 ก.ย. – 4 ต.ค.', days: [28, 29, 30, 1, 2, 3, 4] }];
  let days = '';
  for (const w of weeks) days += `<div class="wk" style="width:${7 * DAY}px"><div class="wk-name">${w.name}</div><div class="wk-days">${w.days.map((n, i) => `<div class="d${i >= 5 ? ' we' : ''}" style="width:${DAY}px">${n}</div>`).join('')}</div></div>`;
  let rows = '';
  for (let i = 0; i < 3; i++) rows += `<div class="we-col" style="left:${(i * 7 + 5) * DAY}px;width:${2 * DAY}px"></div>`;
  for (let i = 0; i <= tasks.length; i++) rows += '<div class="grid-row"></div>';
  rows += `<div class="today" style="left:${DAY}px"></div>`;
  tasks.forEach((t, i) => {
    rows += `<div class="tb${t.crit ? ' crit' : ''}${selected === t.n ? ' sel' : ''}" style="left:${t.s * DAY}px;top:${i * ROW + 8}px;width:${(t.e - t.s + 1) * DAY}px"><div class="pg" style="width:${t.pg}%"></div></div>`;
    if (t.who) rows += `<div class="asg" style="left:${(t.e + 1) * DAY + 20}px;top:${i * ROW + 9}px">${t.who.map((k) => `<span class="av asg-av${k === 'ด' ? ' over' : ''}" style="background:${who[k]}">${k}</span>`).join('')}</div>`;
  });
  rows += `<div class="ms" style="left:${23 * DAY - 7}px;top:${tasks.length * ROW + 13}px"></div>`;
  let names = '<div class="nc head">ชื่องาน</div>';
  for (const t of tasks) names += `<div class="nc"><span class="dot${t.crit ? ' crit' : ''}"></span><span class="t">${t.name}</span></div>`;
  names += '<div class="nc"><span class="dot ms"></span><span class="t">ส่งมอบ</span></div>';
  return `${hdr}
  <div class="bar"><div class="seg"><span class="on">สัปดาห์</span><span>เดือน</span></div><div style="flex:1"></div><div class="chip">Critical 4</div></div>
  <div class="card"><div class="namecol">${names}</div><div class="tl"><div class="days">${days}</div><div class="rows" style="height:${(tasks.length + 1) * ROW}px">${rows}</div></div></div>
  <div style="height:10px;flex-shrink:0"></div>
  <div class="fab-today">${I.today(22)}</div>
  ${bnav('gantt')}`;
}

const M = {};
M['MobileGantt.dc.html'] = wrap(`<div class="phone">${ganttMobile()}</div>`);

M['MobileTaskSheet.dc.html'] = wrap(`<div class="phone">${ganttMobile(2)}
  <div class="dim"></div>
  <div class="sheet">
    <div class="handle"></div>
    <div class="sh-head"><div><div class="crumb">งาน #2</div><h2>ออกแบบระบบ</h2></div><div class="iconbtn">${I.x(18)}</div></div>
    <div><span class="chip">อยู่บน Critical path</span></div>
    <div class="frow"><div class="field"><div class="label">ระยะเวลา</div><div class="input"><span>5 วัน</span></div></div><div class="field"><div class="label">ความคืบหน้า</div><div class="input"><span>40%</span></div></div></div>
    <div class="frow"><div class="field"><div class="label">เริ่ม</div><div class="input ro"><span>17 ก.ย. 2569</span></div></div><div class="field"><div class="label">สิ้นสุด</div><div class="input ro"><span>23 ก.ย. 2569</span></div></div></div>
    <div class="field"><div class="label">งานก่อนหน้า</div><div class="dep"><span class="dep-name">รวบรวมความต้องการ</span><span class="pill">FS</span><span class="pill soft">+0 วัน</span></div><div class="dep add">${I.plus(16)}<span>เพิ่มงานก่อนหน้า</span></div></div>
    <div class="field"><div class="label">ผู้รับผิดชอบ</div><div class="dep"><span class="av" style="background:${who['ส']}">ส</span><span class="dep-name">สมชาย</span><span class="pill soft">100%</span></div></div>
    <div class="cpm"><div class="cpm-title">Critical Path Method</div><div class="cpm-grid"><div><span>ES</span><b>17 ก.ย.</b></div><div><span>EF</span><b>23 ก.ย.</b></div><div><span>LS</span><b>17 ก.ย.</b></div><div><span>LF</span><b>23 ก.ย.</b></div></div></div>
    <div class="save">บันทึก</div>
  </div>
</div>`);

M['MobileCalendar.dc.html'] = wrap(`<div class="phone">${hdr}
  <div class="avrow">
    <div class="avchip"><span class="av" style="background:#8a83a8">∗</span>ทุกคน</div>
    <div class="avchip"><span class="av" style="background:${who['ส']}">ส</span>สมชาย</div>
    <div class="avchip on"><span class="av" style="background:${who['ด']}">ด</span>สุดา</div>
    <div class="avchip"><span class="av" style="background:${who['ว']}">ว</span>วิชัย</div>
  </div>
  <div class="wknav"><div class="iconbtn">${I.left(18)}</div><h3>21 – 27 ก.ย. 2569</h3><div class="iconbtn">${I.right(18)}</div></div>
  <div class="clist">
    <div class="day over"><div class="dn"><b>21</b><span>จ.</span></div><div class="dtasks"><div class="tchip">ออกแบบ UI</div><div class="tchip">พัฒนา Frontend</div></div><div class="pct">${I.warn(16)}150%</div></div>
    <div class="day over"><div class="dn"><b>22</b><span>อ.</span></div><div class="dtasks"><div class="tchip">ออกแบบ UI</div><div class="tchip">พัฒนา Frontend</div></div><div class="pct">${I.warn(16)}150%</div></div>
    <div class="day"><div class="dn"><b>23</b><span>พ.</span></div><div class="dtasks"><div class="tchip">พัฒนา Frontend</div></div></div>
    <div class="day"><div class="dn"><b>24</b><span>พฤ.</span></div><div class="dtasks"><div class="tchip">พัฒนา Frontend</div></div></div>
    <div class="day"><div class="dn"><b>25</b><span>ศ.</span></div><div class="dtasks"><div class="tchip">พัฒนา Frontend</div></div></div>
    <div class="day we"><div class="dn"><b>26</b><span>ส.</span></div><div class="free">วันหยุด</div></div>
    <div class="day we"><div class="dn"><b>27</b><span>อา.</span></div><div class="free">วันหยุด</div></div>
  </div>
  <div style="height:10px;flex-shrink:0"></div>
  ${bnav('cal')}
</div>`);

for (const [f, html] of Object.entries(M)) { writeFileSync(f, html); console.log('built', f); }
