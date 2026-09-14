import { writeFileSync } from 'node:fs';

const tasks = [
  { n: 1, name: 'รวบรวมความต้องการ', dur: 3, s: 0, e: 2, crit: true, float: 0, pg: 100, start: '14 ก.ย.', end: '16 ก.ย.', who: 'ส' },
  { n: 2, name: 'ออกแบบระบบ', dur: 5, s: 3, e: 9, crit: true, float: 0, pg: 40, start: '17 ก.ย.', end: '23 ก.ย.', who: 'ส' },
  { n: 3, name: 'ออกแบบ UI', dur: 4, s: 3, e: 8, crit: false, float: 1, pg: 25, start: '17 ก.ย.', end: '22 ก.ย.', who: 'ด' },
  { n: 4, name: 'พัฒนา Backend', dur: 6, s: 10, e: 17, crit: true, float: 0, pg: 0, start: '24 ก.ย.', end: '1 ต.ค.', who: 'ว' },
  { n: 5, name: 'พัฒนา Frontend', dur: 5, s: 9, e: 15, crit: false, float: 2, pg: 0, start: '23 ก.ย.', end: '29 ก.ย.', who: 'ด' },
  { n: 6, name: 'ทดสอบระบบ', dur: 3, s: 18, e: 22, crit: true, float: 0, pg: 0, start: '2 ต.ค.', end: '6 ต.ค.', who: 'ส' },
];
const links = [[1, 2, true], [1, 3, false], [2, 4, true], [3, 5, false], [4, 6, true], [5, 6, false]];
const weeks = [
  { name: '14 – 20 ก.ย.', days: [14, 15, 16, 17, 18, 19, 20] },
  { name: '21 – 27 ก.ย.', days: [21, 22, 23, 24, 25, 26, 27] },
  { name: '28 ก.ย. – 4 ต.ค.', days: [28, 29, 30, 1, 2, 3, 4] },
  { name: '5 – 11 ต.ค.', days: [5, 6, 7, 8, 9, 10, 11] },
];
const CRIT = '#e0457b', LINK = '#b7b1d6';
const who = { ส: '#6a4fd8', ด: '#e0457b', ว: '#1f9e89' };

const icon = (p) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const I = {
  proj: icon('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>'),
  gantt: icon('<path d="M4 6h8"></path><path d="M9 12h9"></path><path d="M6 18h7"></path>'),
  cal: icon('<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M3 10h18"></path><path d="M8 3v4"></path><path d="M16 3v4"></path>'),
  res: icon('<circle cx="9" cy="8" r="3.5"></circle><path d="M2.5 20a6.5 6.5 0 0 1 13 0"></path><path d="M16 4.5a3.5 3.5 0 0 1 0 7"></path><path d="M17.5 14a6 6 0 0 1 4 6"></path>'),
  plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>',
  list: icon('<path d="M4 6h16"></path><path d="M4 12h16"></path><path d="M4 18h16"></path>'),
  chev: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"></path></svg>',
  warn: icon('<path d="M12 3l10 18H2z"></path><path d="M12 10v5"></path><path d="M12 18h.01"></path>'),
  x: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12"></path><path d="M18 6L6 18"></path></svg>',
};

// ---------- building blocks ----------
function timeline({ day, row, barH = 26, weeksN = 4, showNames = true }) {
  const top = (row - barH) / 2, W = weeksN * 7 * day;
  let days = '';
  for (const w of weeks.slice(0, weeksN)) {
    days += `<div class="wk" style="width:${7 * day}px"><div class="wk-name">${w.name}</div><div class="wk-days">`;
    w.days.forEach((n, i) => { days += `<div class="d${i >= 5 ? ' we' : ''}" style="width:${day}px">${n}</div>`; });
    days += '</div></div>';
  }
  let rows = '';
  for (let i = 0; i < weeksN; i++) rows += `<div class="we-col" style="left:${(i * 7 + 5) * day}px;width:${2 * day}px"></div>`;
  for (let i = 0; i <= tasks.length; i++) rows += `<div class="grid-row" style="height:${row}px"></div>`;
  rows += `<div class="today" style="left:${day}px"></div>`;
  let paths = '';
  for (const [a, b, crit] of links) {
    const A = tasks[a - 1], B = tasks[b - 1];
    const x1 = (A.e + 1) * day, y1 = (a - 1) * row + row / 2, x2 = B.s * day, y2 = (b - 1) * row + row / 2;
    const dd = x2 > x1 + 12 ? `M${x1} ${y1} h${(x2 - x1) / 2} V${y2} H${x2}` : `M${x1} ${y1} h6 V${y2 - row / 2} H${x2 - 5} V${y2} h5`;
    paths += `<path d="${dd}" stroke="${crit ? CRIT : LINK}" marker-end="url(#${crit ? 'ar' : 'ag'})"></path>`;
  }
  const svg = `<svg style="position:absolute;left:0;top:0" width="${W}" height="${(tasks.length + 1) * row}" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><defs><marker id="ar" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6z" fill="${CRIT}" stroke="none"></path></marker><marker id="ag" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6z" fill="${LINK}" stroke="none"></path></marker></defs>${paths}</svg>`;
  let bars = '';
  tasks.forEach((t, i) => {
    const l = t.s * day, w = (t.e - t.s + 1) * day, y = i * row + top;
    bars += `<div class="bar${t.crit ? ' crit' : ''}" style="left:${l}px;top:${y}px;width:${w}px;height:${barH}px"><div class="pg" style="width:${t.pg}%"></div>${showNames && w > 90 ? `<span>${t.name}</span>` : ''}</div>`;
    if (t.float) bars += `<div class="float" style="left:${l + w}px;top:${y}px;width:${t.float * day}px;height:${barH}px"></div>`;
  });
  bars += `<div class="ms" style="left:${23 * day - 8}px;top:${tasks.length * row + row / 2 - 8}px"></div>`;
  return `<div class="tl"><div class="days">${days}</div><div class="rows" style="height:${(tasks.length + 1) * row}px">${rows}${svg}${bars}</div></div>`;
}

function table({ row, width, cols = ['n', 'name', 'dur', 'start', 'end', 'float'] }) {
  const head = { n: '#', name: 'ชื่องาน', dur: 'ระยะ', start: 'เริ่ม', end: 'สิ้นสุด', float: 'Float', who: 'ผู้ทำ' };
  const cell = (t, c) => {
    if (c === 'n') return `<div class="c-n">${t.n}</div>`;
    if (c === 'name') return `<div class="c-name"><span class="dot${t.crit ? ' crit' : ''}"></span>${t.name}</div>`;
    if (c === 'dur') return `<div class="c-num">${t.dur} วัน</div>`;
    if (c === 'start') return `<div class="c-num w60">${t.start}</div>`;
    if (c === 'end') return `<div class="c-num w60">${t.end}</div>`;
    if (c === 'float') return `<div class="c-num w44${t.crit ? ' crit' : ''}">${t.float}</div>`;
    if (c === 'who') return `<div class="c-who"><span class="av" style="background:${who[t.who]}">${t.who}</span></div>`;
  };
  let out = `<div class="tbl" style="width:${width}px"><div class="tr head">${cols.map((c) => `<div class="c-${c === 'name' ? 'name' : c === 'n' ? 'n' : c === 'who' ? 'who' : 'num' + (c === 'float' ? ' w44' : c === 'dur' ? '' : ' w60')}">${head[c]}</div>`).join('')}</div>`;
  for (const t of tasks) out += `<div class="tr${t.crit ? ' crit' : ''}" style="height:${row}px">${cols.map((c) => cell(t, c)).join('')}</div>`;
  const msT = { n: 7, name: 'ส่งมอบ', dur: '—', start: '6 ต.ค.', end: '6 ต.ค.', float: 0, crit: true, who: 'ส' };
  out += `<div class="tr" style="height:${row}px">${cols.map((c) => c === 'name' ? `<div class="c-name"><span class="dot ms"></span>ส่งมอบ</div>` : c === 'dur' ? `<div class="c-num">—</div>` : cell(msT, c)).join('')}</div>`;
  return out + '</div>';
}

const gantt = (o) => `<div class="gantt">${table(o)}${timeline(o)}</div>`;

const sidebar = (compact = false) => `<div class="side${compact ? ' compact' : ''}">
  <div class="brand"><div class="brand-mark"></div>${compact ? '' : '<div class="brand-name">แผนงาน</div>'}</div>
  <div class="nav">${I.proj}${compact ? '' : '<span>โปรเจกต์</span>'}</div>
  <div class="nav on">${I.gantt}${compact ? '' : '<span>Gantt</span>'}</div>
  <div class="nav">${I.cal}${compact ? '' : '<span>ปฏิทิน</span>'}</div>
  <div class="nav">${I.res}${compact ? '' : '<span>ทรัพยากร</span>'}</div>
</div>`;

const seg = `<div class="seg"><span class="on">วัน</span><span>สัปดาห์</span><span>เดือน</span></div>`;
const addBtn = `<div class="btn primary">${I.plus}<span>เพิ่มงาน</span></div>`;
const topbar = (extra = '') => `<div class="top"><div class="title"><div class="crumb">โปรเจกต์ › ระบบจองห้องประชุม</div><h1>Gantt</h1></div>${seg}<div class="spacer"></div>${extra}<div class="chip">Critical path · 4 งาน</div><div class="chip soft">กำหนดเสร็จ 6 ต.ค. 2569</div>${addBtn}</div>`;
const foot = (n, title, desc) => `<div class="foot"><span class="tag">Layout ${n}</span><strong>${title}</strong><span class="desc">${desc}</span></div>`;

const detailPanel = `<div class="panel">
  <div class="panel-head"><div><div class="crumb">งาน #2</div><h2>ออกแบบระบบ</h2></div><div class="iconbtn">${I.x}</div></div>
  <div class="chip" style="align-self:flex-start">อยู่บน Critical path</div>
  <div class="frow"><div class="field"><div class="label">ระยะเวลา</div><div class="input">5 วัน</div></div><div class="field"><div class="label">ความคืบหน้า</div><div class="input">40%</div></div></div>
  <div class="frow"><div class="field"><div class="label">เริ่ม</div><div class="input ro">17 ก.ย. 2569</div></div><div class="field"><div class="label">สิ้นสุด</div><div class="input ro">23 ก.ย. 2569</div></div></div>
  <div class="field"><div class="label">งานก่อนหน้า</div>
    <div class="dep"><span class="dep-name">รวบรวมความต้องการ</span><span class="pill">FS</span><span class="pill soft">+0 วัน</span></div>
    <div class="dep add">${I.plus}<span>เพิ่มงานก่อนหน้า</span></div>
  </div>
  <div class="field"><div class="label">ผู้รับผิดชอบ</div><div class="dep"><span class="av" style="background:${who['ส']}">ส</span><span class="dep-name">สมชาย</span><span class="pill soft">100%</span></div></div>
  <div class="cpm"><div class="cpm-title">Critical Path Method</div>
    <div class="cpm-grid"><div><span>ES</span><b>17 ก.ย.</b></div><div><span>EF</span><b>23 ก.ย.</b></div><div><span>LS</span><b>17 ก.ย.</b></div><div><span>LF</span><b>23 ก.ย.</b></div></div>
    <div class="cpm-float">Total float <b>0 วัน</b> · เลื่อนไม่ได้เลย</div>
  </div>
  <div class="spacer"></div>
  <div class="frow"><div class="btn primary" style="flex:1;justify-content:center">บันทึก</div><div class="btn ghost">ลบ</div></div>
</div>`;

const kpis = `<div class="kpis">
  <div class="kpi"><div class="kpi-label">กำหนดเสร็จ</div><div class="kpi-val">6 ต.ค.</div><div class="kpi-sub">อีก 16 วันทำงาน</div></div>
  <div class="kpi crit"><div class="kpi-label">Critical path</div><div class="kpi-val">4 งาน</div><div class="kpi-sub">รวม 17 วัน</div></div>
  <div class="kpi"><div class="kpi-label">ความคืบหน้า</div><div class="kpi-val">32%</div><div class="kpi-bar"><div style="width:32%"></div></div></div>
  <div class="kpi warn"><div class="kpi-label">เกินกำลัง</div><div class="kpi-val">1 คน</div><div class="kpi-sub">สุดา · 21 ก.ย.</div></div>
</div>`;

const loadCard = `<div class="card load">
  <div class="card-head"><h3>ภาระงานสัปดาห์นี้</h3><span class="crumb">14 – 20 ก.ย.</span></div>
  ${[['ส', 'สมชาย', 100, false], ['ด', 'สุดา', 150, true], ['ว', 'วิชัย', 60, false]].map(([k, n, p, over]) => `<div class="lrow"><span class="av" style="background:${who[k]}">${k}</span><span class="lname">${n}</span><div class="lbar"><div class="${over ? 'over' : ''}" style="width:${Math.min(p, 150) / 1.5}%"></div></div><span class="lpct${over ? ' over' : ''}">${p}%</span></div>`).join('')}
  <div class="lrow"><span class="av" style="background:#8a83a8">S</span><span class="lname">Server A</span><div class="lbar"><div style="width:20%"></div></div><span class="lpct">30%</span></div>
  <div class="warnbox">${I.warn}<span><b>สุดา</b> ถูกมอบหมาย 150% วันที่ 21 – 22 ก.ย. (ออกแบบ UI + พัฒนา Frontend)</span></div>
</div>`;

function heat(day, width) {
  const loads = {
    ส: [1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0],
    ด: [0, 0, 0, 1, 1, 0, 0, 2, 2, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ว: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  };
  const names = { ส: 'สมชาย', ด: 'สุดา', ว: 'วิชัย' };
  let rows = '';
  for (const k of Object.keys(loads)) {
    rows += `<div class="hrow"><div class="hname" style="width:${width}px"><span class="av" style="background:${who[k]}">${k}</span>${names[k]}</div><div class="hcells">${loads[k].map((v, i) => `<div class="hc${v === 2 ? ' over' : v === 1 ? ' full' : ''}${i % 7 >= 5 ? ' we' : ''}" style="width:${day}px">${v === 2 ? '150%' : ''}</div>`).join('')}</div></div>`;
  }
  return `<div class="card heat"><div class="card-head" style="padding:12px 16px 4px"><h3>ภาระงานทรัพยากร</h3><span class="crumb">แกนเวลาเดียวกับ Gantt ด้านบน</span></div>${rows}</div>`;
}

// ---------- shared CSS (direction D) ----------
const css = `
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Kanit", "Segoe UI", Tahoma, sans-serif; color: #2f2a4a; background: #f2f0fa; font-size: 13px; }
    a { color: #6a4fd8; } a:hover { color: #4e37b0; }
    .app { display: flex; width: 1280px; height: 720px; background: #f2f0fa; overflow: hidden; gap: 16px; padding: 16px; }
    .app.col { flex-direction: column; }
    .side { width: 188px; flex-shrink: 0; background: #6a4fd8; border-radius: 18px; padding: 20px 12px; display: flex; flex-direction: column; gap: 6px; color: #ffffff; }
    .side.compact { width: 64px; padding: 16px 10px; align-items: center; }
    .brand { display: flex; align-items: center; gap: 10px; padding: 4px 8px 22px; } .side.compact .brand { padding: 4px 0 18px; }
    .brand-mark { width: 30px; height: 30px; border-radius: 10px; background: #ffd166; flex-shrink: 0; } .brand-name { font-weight: 600; font-size: 17px; }
    .nav { display: flex; align-items: center; gap: 10px; height: 42px; padding: 0 12px; border-radius: 12px; color: #d9d2f7; } .side.compact .nav { width: 44px; height: 44px; padding: 0; justify-content: center; }
    .nav.on { background: #ffffff; color: #4e37b0; font-weight: 500; }
    .main { flex: 1; display: flex; flex-direction: column; min-width: 0; gap: 12px; }
    .top { min-height: 56px; display: flex; align-items: center; gap: 12px; padding: 0 8px; }
    .crumb { font-size: 12px; color: #8a83a8; } h1 { margin: 0; font-size: 20px; font-weight: 600; line-height: 1.2; } h2 { margin: 0; font-size: 18px; font-weight: 600; } h3 { margin: 0; font-size: 14px; font-weight: 600; }
    .seg { display: flex; background: #ffffff; border-radius: 999px; padding: 4px; height: 40px; margin-left: 8px; box-shadow: 0 1px 2px rgba(47,42,74,0.06); } .seg span { display: flex; align-items: center; padding: 0 16px; border-radius: 999px; color: #6f6893; } .seg span.on { background: #6a4fd8; color: #ffffff; font-weight: 500; }
    .spacer { flex: 1; }
    .chip { height: 30px; padding: 0 12px; border-radius: 999px; font-size: 12px; font-weight: 500; background: #ffe0ec; color: #b8285a; display: inline-flex; align-items: center; gap: 6px; } .chip.soft { background: #ffffff; color: #6f6893; }
    .btn { height: 40px; padding: 0 16px; border-radius: 999px; display: flex; align-items: center; gap: 6px; font-weight: 500; background: #ffffff; color: #2f2a4a; } .btn.primary { background: #2f2a4a; color: #ffffff; box-shadow: 0 6px 16px rgba(47,42,74,0.18); } .btn.ghost { background: #f2f0fa; color: #b8285a; }
    .iconbtn { width: 32px; height: 32px; border-radius: 999px; background: #f2f0fa; display: flex; align-items: center; justify-content: center; color: #6f6893; }
    .card { background: #ffffff; border-radius: 18px; box-shadow: 0 2px 8px rgba(47,42,74,0.06); overflow: hidden; }
    .card-head { display: flex; align-items: baseline; gap: 10px; padding: 16px 16px 8px; }
    .gantt { display: flex; flex: 1; min-height: 0; background: #ffffff; border-radius: 18px; box-shadow: 0 2px 8px rgba(47,42,74,0.06); overflow: hidden; }
    .tbl { flex-shrink: 0; border-right: 1px solid #ece9f6; }
    .tr { display: flex; align-items: center; border-bottom: 1px solid #f1eff8; padding: 0 12px 0 16px; } .tr.head { height: 56px; font-size: 12px; color: #8a83a8; font-weight: 500; }
    .c-n { width: 26px; color: #b7b1d6; } .c-name { flex: 1; display: flex; align-items: center; gap: 8px; min-width: 0; white-space: nowrap; overflow: hidden; } .c-num { width: 50px; text-align: right; font-variant-numeric: tabular-nums; } .c-num.w60 { width: 60px; } .c-num.w44 { width: 44px; } .c-num.crit { color: #b8285a; font-weight: 600; } .c-who { width: 40px; display: flex; justify-content: flex-end; }
    .dot { width: 10px; height: 10px; border-radius: 999px; background: #8fd3c7; flex-shrink: 0; } .dot.crit { background: #e0457b; } .dot.ms { background: #ffd166; border-radius: 2px; transform: rotate(45deg); }
    .av { width: 22px; height: 22px; border-radius: 999px; color: #ffffff; font-size: 11px; font-weight: 500; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .tl { flex: 1; position: relative; overflow: hidden; }
    .days { display: flex; height: 56px; border-bottom: 1px solid #ece9f6; } .wk { display: flex; flex-direction: column; flex-shrink: 0; border-right: 1px solid #ece9f6; } .wk-name { height: 26px; display: flex; align-items: center; padding: 0 10px; font-size: 12px; font-weight: 500; color: #4e37b0; white-space: nowrap; } .wk-days { display: flex; } .d { height: 30px; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #8a83a8; } .d.we { color: #c9c4e0; }
    .rows { position: relative; } .grid-row { border-bottom: 1px solid #f1eff8; } .we-col { position: absolute; top: 0; bottom: 0; background: #f7f5fc; }
    .bar { position: absolute; display: flex; align-items: center; padding: 0 12px; white-space: nowrap; overflow: hidden; border-radius: 999px; background: #8fd3c7; color: #1f4d45; font-size: 11px; font-weight: 500; } .bar.crit { background: #e0457b; color: #ffffff; } .pg { position: absolute; left: 0; top: 0; bottom: 0; background: rgba(0,0,0,0.12); } .bar span { position: relative; }
    .float { position: absolute; border: 2px dashed #d6d1ea; border-left: 0; border-radius: 0 999px 999px 0; } .ms { position: absolute; width: 16px; height: 16px; background: #ffd166; border-radius: 4px; transform: rotate(45deg); }
    .today { position: absolute; top: 0; bottom: 0; width: 2px; background: #6a4fd8; border-radius: 2px; }
    .foot { height: 40px; display: flex; align-items: center; gap: 12px; padding: 0 8px; font-size: 12px; color: #6f6893; flex-shrink: 0; } .tag { background: #6a4fd8; color: #ffffff; padding: 2px 10px; border-radius: 999px; font-weight: 500; } .foot strong { color: #2f2a4a; }
    /* header bar (layout 2) */
    .hbar { height: 60px; background: #6a4fd8; border-radius: 18px; display: flex; align-items: center; gap: 16px; padding: 0 20px; color: #ffffff; flex-shrink: 0; }
    .hbar .brand { padding: 0; } .hbar .switch { display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 14px; border-radius: 999px; background: rgba(255,255,255,0.14); font-weight: 500; }
    .tabs { display: flex; gap: 4px; margin-left: 12px; } .tabs span { display: flex; align-items: center; gap: 8px; height: 38px; padding: 0 16px; border-radius: 999px; color: #d9d2f7; } .tabs span.on { background: #ffffff; color: #4e37b0; font-weight: 500; }
    .rail { width: 48px; flex-shrink: 0; border-right: 1px solid #ece9f6; display: flex; flex-direction: column; align-items: center; padding-top: 12px; gap: 8px; color: #6f6893; } .rail .vtext { writing-mode: vertical-rl; font-size: 12px; color: #8a83a8; }
    /* detail panel (layout 3) */
    .panel { width: 320px; flex-shrink: 0; background: #ffffff; border-radius: 18px; box-shadow: 0 2px 8px rgba(47,42,74,0.06); padding: 20px; display: flex; flex-direction: column; gap: 14px; }
    .panel-head { display: flex; align-items: flex-start; justify-content: space-between; }
    .frow { display: flex; gap: 10px; } .frow .field { flex: 1; }
    .field { display: flex; flex-direction: column; gap: 6px; } .label { font-size: 12px; color: #8a83a8; font-weight: 500; }
    .input { height: 38px; border-radius: 12px; background: #f2f0fa; padding: 0 12px; display: flex; align-items: center; } .input.ro { color: #6f6893; }
    .dep { display: flex; align-items: center; gap: 8px; height: 38px; border-radius: 12px; background: #f2f0fa; padding: 0 12px; } .dep-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .dep.add { background: transparent; border: 2px dashed #d6d1ea; color: #8a83a8; justify-content: center; }
    .pill { height: 24px; padding: 0 8px; border-radius: 999px; background: #6a4fd8; color: #ffffff; font-size: 11px; font-weight: 500; display: inline-flex; align-items: center; } .pill.soft { background: #e6e1fb; color: #4e37b0; }
    .cpm { border-radius: 14px; background: #ffe0ec; padding: 14px; display: flex; flex-direction: column; gap: 10px; } .cpm-title { font-size: 12px; font-weight: 500; color: #b8285a; }
    .cpm-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; } .cpm-grid div { display: flex; flex-direction: column; } .cpm-grid span { font-size: 11px; color: #b8285a; } .cpm-grid b { font-size: 12px; font-weight: 600; }
    .cpm-float { font-size: 12px; color: #b8285a; } .cpm-float b { color: #2f2a4a; }
    /* kpis (layout 4) */
    .kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .kpi { background: #ffffff; border-radius: 16px; padding: 14px 16px; display: flex; flex-direction: column; gap: 2px; box-shadow: 0 2px 8px rgba(47,42,74,0.06); } .kpi.crit { background: #ffe0ec; } .kpi.warn { background: #fff3d6; }
    .kpi-label { font-size: 12px; color: #8a83a8; } .kpi.crit .kpi-label { color: #b8285a; } .kpi.warn .kpi-label { color: #9a6b00; }
    .kpi-val { font-size: 24px; font-weight: 600; line-height: 1.2; } .kpi-sub { font-size: 12px; color: #6f6893; }
    .kpi-bar { height: 8px; border-radius: 999px; background: #f2f0fa; margin-top: 8px; } .kpi-bar div { height: 8px; border-radius: 999px; background: #6a4fd8; }
    .split { display: flex; gap: 12px; flex: 1; min-height: 0; } .split .gantt { flex: 1; }
    .load { width: 340px; flex-shrink: 0; display: flex; flex-direction: column; gap: 10px; padding-bottom: 16px; }
    .lrow { display: flex; align-items: center; gap: 10px; padding: 0 16px; } .lname { width: 64px; } .lbar { flex: 1; height: 10px; border-radius: 999px; background: #f2f0fa; overflow: hidden; } .lbar div { height: 10px; border-radius: 999px; background: #8fd3c7; } .lbar .over { background: #e0457b; } .lpct { width: 40px; text-align: right; font-variant-numeric: tabular-nums; } .lpct.over { color: #b8285a; font-weight: 600; }
    .warnbox { margin: 6px 16px 0; padding: 12px; border-radius: 12px; background: #fff3d6; color: #6b4a00; display: flex; gap: 10px; font-size: 12px; line-height: 1.4; } .warnbox svg { flex-shrink: 0; color: #c98a00; }
    /* heat (layout 5) */
    .heat { flex-shrink: 0; }
    .hrow { display: flex; align-items: center; height: 40px; border-top: 1px solid #f1eff8; } .hname { display: flex; align-items: center; gap: 8px; padding-left: 16px; flex-shrink: 0; border-right: 1px solid #ece9f6; height: 40px; }
    .hcells { display: flex; height: 40px; padding: 6px 0; } .hc { height: 28px; margin: 0 1px; border-radius: 6px; background: #f7f5fc; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; color: #ffffff; } .hc.full { background: #8fd3c7; } .hc.over { background: #e0457b; } .hc.we { background: transparent; }
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

// ---------- layouts ----------
const L = {};

L['Main.dc.html'] = wrap(`<div class="app">
  ${sidebar()}
  <div class="main">
    ${topbar()}
    ${gantt({ day: 25, row: 44, width: 340 })}
    ${foot(1, 'มาตรฐาน: เมนูซ้าย + ตาราง | ไทม์ไลน์', 'โครงที่คนคุ้นเคยที่สุด เห็นตัวเลขและแถบพร้อมกัน · เสียพื้นที่ให้ตารางค่อนข้างมาก')}
  </div>
</div>`);

L['Layout2.dc.html'] = wrap(`<div class="app col">
  <div class="hbar">
    <div class="brand"><div class="brand-mark"></div><div class="brand-name">แผนงาน</div></div>
    <div class="switch">ระบบจองห้องประชุม ${I.chev}</div>
    <div class="tabs"><span class="on">${I.gantt}Gantt</span><span>${I.cal}ปฏิทิน</span><span>${I.res}ทรัพยากร</span></div>
    <div class="spacer"></div>
    <div class="av" style="background:#ffd166;color:#2f2a4a;width:34px;height:34px">ส</div>
  </div>
  <div class="top" style="min-height:44px"><div class="btn" style="height:36px">${I.list}<span>รายการงาน</span></div>${seg}<div class="spacer"></div><div class="chip">Critical path · 4 งาน</div><div class="chip soft">กำหนดเสร็จ 6 ต.ค. 2569</div>${addBtn}</div>
  <div class="gantt">
    ${table({ row: 44, width: 220, cols: ['n', 'name'] })}
    ${timeline({ day: 36, row: 44 })}
  </div>
  ${foot(2, 'ไทม์ไลน์เต็มจอ: เมนูอยู่บน ตารางยุบเหลือชื่องาน', 'ให้พื้นที่กับ Gantt มากที่สุด เหมาะจอเล็กหรือ zoom ระดับเดือน · รายละเอียดตัวเลขต้องกดเปิดแยก')}
</div>`);

L['Layout3.dc.html'] = wrap(`<div class="app">
  ${sidebar(true)}
  <div class="main">
    ${topbar()}
    <div class="split">
      ${gantt({ day: 21, row: 44, width: 250, cols: ['n', 'name', 'float'] })}
      ${detailPanel}
    </div>
    ${foot(3, 'สามคอลัมน์: เมนูย่อ + Gantt + แผงรายละเอียดขวา', 'คลิกงานแล้วแก้ได้ทันทีโดยไม่บังไทม์ไลน์ เห็นค่า CPM ของงานที่เลือกตลอด · Gantt แคบลง')}
  </div>
</div>`);

L['Layout4.dc.html'] = wrap(`<div class="app">
  ${sidebar()}
  <div class="main">
    ${topbar()}
    ${kpis}
    <div class="split">
      ${gantt({ day: 19, row: 40, width: 220, weeksN: 3, cols: ['n', 'name', 'who'], showNames: false })}
      ${loadCard}
    </div>
    ${foot(4, 'แดชบอร์ด: ตัวเลขสรุปด้านบน + Gantt คู่กับภาระงาน', 'มองภาพรวมโปรเจกต์กับทรัพยากรได้ในจอเดียว เหมาะเปิดดูตอนเช้า · Gantt เหลือพื้นที่น้อย เห็นแค่ 3 สัปดาห์')}
  </div>
</div>`);

L['Layout5.dc.html'] = wrap(`<div class="app">
  ${sidebar()}
  <div class="main">
    ${topbar()}
    ${gantt({ day: 26, row: 36, width: 300, cols: ['n', 'name', 'dur', 'float'], barH: 22 })}
    ${heat(26, 300)}
    ${foot(5, 'แบ่งบน-ล่าง: Gantt + ภาระงานทรัพยากรบนแกนเวลาเดียวกัน', 'เห็นทันทีว่างานที่ทับกันทำให้ใครเกินกำลังวันไหน เป็นโครงแบบเครื่องมือวางแผนมืออาชีพ · แถวแคบลงเพื่อให้พอดีจอ')}
  </div>
</div>`);

for (const [f, html] of Object.entries(L)) { writeFileSync(f, html); console.log('built', f); }

const canvas = {
  pages: [{ id: 'settings', name: 'ตั้งค่า + Buffer + WBS' }, { id: 'mobile', name: 'มือถือ (Layout 2)' }, { id: 'layouts', name: 'Layout (แบบ D)' }, { id: 'directions', name: 'แนวทางที่เคยเสนอ' }],
  artboards: [
    { file: 'GanttBuffer.dc.html', title: 'Desktop · Gantt กลุ่มงาน + สำรองเวลา', x: 0, y: 0, w: 1280, h: 720, page: 'settings' },
    { file: 'SettingsDesktop.dc.html', title: 'Desktop · ตั้งค่าโปรเจกต์', x: 0, y: 860, w: 1280, h: 1400, page: 'settings' },
    { file: 'SettingsMobile.dc.html', title: 'มือถือ · ตั้งค่า สำรองเวลา', x: 1380, y: 860, w: 390, h: 844, page: 'settings' },
    { file: 'MobileGantt.dc.html', title: 'มือถือ · Gantt', x: 0, y: 0, w: 390, h: 844, page: 'mobile' },
    { file: 'MobileTaskSheet.dc.html', title: 'มือถือ · แผงงาน (bottom sheet)', x: 490, y: 0, w: 390, h: 844, page: 'mobile' },
    { file: 'MobileCalendar.dc.html', title: 'มือถือ · ปฏิทินตามทรัพยากร', x: 980, y: 0, w: 390, h: 844, page: 'mobile' },
    { file: 'Main.dc.html', title: 'Layout 1 · มาตรฐาน', x: 0, y: 0, w: 1280, h: 720, page: 'layouts' },
    { file: 'Layout2.dc.html', title: 'Layout 2 · ไทม์ไลน์เต็มจอ (เลือกแล้ว)', x: 1380, y: 0, w: 1280, h: 720, page: 'layouts' },
    { file: 'Layout3.dc.html', title: 'Layout 3 · แผงรายละเอียดขวา', x: 0, y: 860, w: 1280, h: 720, page: 'layouts' },
    { file: 'Layout4.dc.html', title: 'Layout 4 · แดชบอร์ด', x: 1380, y: 860, w: 1280, h: 720, page: 'layouts' },
    { file: 'Layout5.dc.html', title: 'Layout 5 · Gantt + ภาระงาน', x: 0, y: 1720, w: 1280, h: 720, page: 'layouts' },
    { file: 'DirectionA.dc.html', title: 'แบบ A · เรียบ ใช้งานจริง', x: 0, y: 0, w: 1280, h: 720, page: 'directions' },
    { file: 'DirectionB.dc.html', title: 'แบบ B · มืด หนาแน่น', x: 1380, y: 0, w: 1280, h: 720, page: 'directions' },
    { file: 'DirectionC.dc.html', title: 'แบบ C · กระดาษ บรรณาธิการ', x: 0, y: 860, w: 1280, h: 720, page: 'directions' },
    { file: 'DirectionD.dc.html', title: 'แบบ D · สดใส เป็นมิตร (เลือกแล้ว)', x: 1380, y: 860, w: 1280, h: 720, page: 'directions' },
    { file: 'DirectionE.dc.html', title: 'แบบ E · โครงร่างหนา', x: 0, y: 1720, w: 1280, h: 720, page: 'directions' },
  ],
  annotations: [
    { id: 'layout-guide', x: 1380, y: 1720, w: 540, page: 'layouts', text: 'Layout 5 แบบ ในสไตล์ D (สดใส เป็นมิตร)\n\n1 มาตรฐาน – ตารางซ้าย ไทม์ไลน์ขวา คุ้นเคยที่สุด\n2 ไทม์ไลน์เต็มจอ – เมนูขึ้นบน ตารางยุบ ให้ Gantt กว้างสุด\n3 แผงรายละเอียดขวา – แก้งานและดู CPM ได้โดยไม่ต้องเปิด modal\n4 แดชบอร์ด – ตัวเลขสรุป + Gantt + ภาระงาน ในจอเดียว\n5 Gantt + ภาระงาน – ทรัพยากรอยู่ใต้ไทม์ไลน์ แกนเวลาเดียวกัน\n\nผสมได้ เช่น 5 เป็นหลัก แล้วเอาแผงขวาของ 3 มาใช้ตอนคลิกงาน' },
    { id: 'directions-note', x: 1380, y: 1720, w: 400, page: 'directions', text: 'เลือกแบบ D แล้ว หน้านี้เก็บไว้อ้างอิง' },
    { id: 'mobile-note', x: 1470, y: 0, w: 420, page: 'mobile', text: 'มือถือ (< 768px) ในโครง Layout 2\n\n• เมนูย้ายลงล่างเป็น BottomNav 3 แท็บ ปุ่ม + ตรงกลางสำหรับเพิ่มงาน\n• Gantt: คอลัมน์ชื่อ 120px ตรึงซ้าย เลื่อนแนวนอนด้วยนิ้ว zoom เริ่มที่สัปดาห์ ไม่มีการลากแถบ แตะเพื่อเปิด sheet\n• แผงงานกลายเป็น bottom sheet เปิดครึ่งจอ ลากขึ้นเต็มจอ ช่องกรอกสูง 44px\n• ปฏิทิน: เลือกคนจากแถวชิปด้านบน แล้วดูรายวันแนวตั้ง วันที่เกินกำลังพื้นชมพู\n\nรายละเอียดอยู่ใน docs/ui-design.md ส่วนที่ 5' },
  ],
  launch: { view: 'canvas', page: 'settings' },
};
writeFileSync('canvas.json', JSON.stringify(canvas, null, 2));
console.log('built canvas.json');
