import { writeFileSync } from 'node:fs';

// ---------- shared data ----------
const tasks = [
  { n: 1, name: 'รวบรวมความต้องการ', dur: 3, s: 0, e: 2, crit: true, float: 0, pg: 100, start: '14 ก.ย.', end: '16 ก.ย.' },
  { n: 2, name: 'ออกแบบระบบ', dur: 5, s: 3, e: 9, crit: true, float: 0, pg: 40, start: '17 ก.ย.', end: '23 ก.ย.' },
  { n: 3, name: 'ออกแบบ UI', dur: 4, s: 3, e: 8, crit: false, float: 1, pg: 25, start: '17 ก.ย.', end: '22 ก.ย.' },
  { n: 4, name: 'พัฒนา Backend', dur: 6, s: 10, e: 17, crit: true, float: 0, pg: 0, start: '24 ก.ย.', end: '1 ต.ค.' },
  { n: 5, name: 'พัฒนา Frontend', dur: 5, s: 9, e: 15, crit: false, float: 2, pg: 0, start: '23 ก.ย.', end: '29 ก.ย.' },
  { n: 6, name: 'ทดสอบระบบ', dur: 3, s: 18, e: 22, crit: true, float: 0, pg: 0, start: '2 ต.ค.', end: '6 ต.ค.' },
];
const links = [ [1, 2, true], [1, 3, false], [2, 4, true], [3, 5, false], [4, 6, true], [5, 6, false] ];
const weeks = [
  { name: '14 – 20 ก.ย. 2569', days: [14, 15, 16, 17, 18, 19, 20] },
  { name: '21 – 27 ก.ย.', days: [21, 22, 23, 24, 25, 26, 27] },
  { name: '28 ก.ย. – 4 ต.ค.', days: [28, 29, 30, 1, 2, 3, 4] },
  { name: '5 – 11 ต.ค.', days: [5, 6, 7, 8, 9, 10, 11] },
];

function timeline(d) {
  const DAY = d.day, ROW = d.row, BH = d.barH, top = (ROW - BH) / 2;
  const W = 28 * DAY;
  let days = '';
  for (const w of weeks) {
    days += `<div class="wk" style="width:${7 * DAY}px"><div class="wk-name">${w.name}</div><div class="wk-days">`;
    w.days.forEach((n, i) => { days += `<div class="d${i >= 5 ? ' we' : ''}" style="width:${DAY}px">${n}</div>`; });
    days += '</div></div>';
  }
  let rows = '';
  for (let i = 0; i < 4; i++) rows += `<div class="we-col" style="left:${(i * 7 + 5) * DAY}px;width:${2 * DAY}px"></div>`;
  for (let i = 0; i < tasks.length; i++) rows += '<div class="grid-row"></div>';
  rows += `<div class="today" style="left:${DAY}px"><div class="today-tag">วันนี้</div></div>`;
  // arrows
  let paths = '';
  for (const [a, b, crit] of links) {
    const A = tasks[a - 1], B = tasks[b - 1];
    const x1 = (A.e + 1) * DAY, y1 = (a - 1) * ROW + ROW / 2;
    const x2 = B.s * DAY, y2 = (b - 1) * ROW + ROW / 2;
    let dd;
    if (x2 > x1 + 12) dd = `M${x1} ${y1} h${(x2 - x1) / 2} V${y2} H${x2}`;
    else dd = `M${x1} ${y1} h8 V${y2 - ROW / 2} H${x2 - 6} V${y2} h6`;
    paths += `<path d="${dd}" stroke="${crit ? d.crit : d.link}" marker-end="url(#${crit ? 'ar' : 'ag'})"></path>`;
  }
  const svg = `<svg style="position:absolute;left:0;top:0" width="${W}" height="${tasks.length * ROW}" fill="none" stroke-width="${d.stroke}" stroke-linecap="round" stroke-linejoin="round"><defs><marker id="ar" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6z" fill="${d.crit}" stroke="none"></path></marker><marker id="ag" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6z" fill="${d.link}" stroke="none"></path></marker></defs>${paths}</svg>`;
  let bars = '';
  tasks.forEach((t, i) => {
    const l = t.s * DAY, w = (t.e - t.s + 1) * DAY, y = i * ROW + top;
    bars += `<div class="bar${t.crit ? ' crit' : ''}" style="left:${l}px;top:${y}px;width:${w}px;height:${BH}px"><div class="pg" style="width:${t.pg}%"></div><span>${t.name}</span></div>`;
    if (t.float) bars += `<div class="float" style="left:${l + w}px;top:${y}px;width:${t.float * DAY}px;height:${BH}px"></div>`;
  });
  bars += `<div class="ms" style="left:${23 * DAY - 8}px;top:${tasks.length * ROW - ROW / 2 - 8 + ROW}px"></div>`;
  return { days, rows, svg, bars, W };
}

function table(d) {
  let out = `<div class="tr head"><div class="c1">#</div><div class="c2">ชื่องาน</div><div class="c3">ระยะ</div><div class="c4">เริ่ม</div><div class="c5">สิ้นสุด</div><div class="c6">Float</div></div>`;
  for (const t of tasks) {
    out += `<div class="tr${t.crit ? ' crit' : ''}" style="height:${d.row}px"><div class="c1">${t.n}</div><div class="c2"><span class="dot${t.crit ? ' crit' : ''}"></span>${t.name}</div><div class="c3">${t.dur} วัน</div><div class="c4">${t.start}</div><div class="c5">${t.end}</div><div class="c6${t.crit ? ' crit' : ''}">${t.float}</div></div>`;
  }
  out += `<div class="tr ms-row" style="height:${d.row}px"><div class="c1">7</div><div class="c2"><span class="dot ms"></span>ส่งมอบ</div><div class="c3">—</div><div class="c4">6 ต.ค.</div><div class="c5">6 ต.ค.</div><div class="c6 crit">0</div></div>`;
  return out;
}

const plus = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>';
const icon = (p) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const icons = {
  proj: icon('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>'),
  gantt: icon('<path d="M4 6h8"></path><path d="M9 12h9"></path><path d="M6 18h7"></path>'),
  cal: icon('<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M3 10h18"></path><path d="M8 3v4"></path><path d="M16 3v4"></path>'),
  res: icon('<circle cx="9" cy="8" r="3.5"></circle><path d="M2.5 20a6.5 6.5 0 0 1 13 0"></path><path d="M16 4.5a3.5 3.5 0 0 1 0 7"></path><path d="M17.5 14a6 6 0 0 1 4 6"></path>'),
};

function page(d) {
  const tl = timeline(d);
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="${d.fontLink}">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; }
    .tr { display: flex; align-items: center; }
    .c1 { width: 26px; } .c2 { flex: 1; display: flex; align-items: center; gap: 8px; min-width: 0; white-space: nowrap; overflow: hidden; } .c3 { width: 50px; text-align: right; } .c4 { width: 60px; text-align: right; } .c5 { width: 60px; text-align: right; } .c6 { width: 44px; text-align: right; }
    .c3, .c4, .c5, .c6 { font-variant-numeric: tabular-nums; }
    .dot { width: 8px; height: 8px; border-radius: 999px; flex-shrink: 0; }
    .wk { display: flex; flex-direction: column; flex-shrink: 0; } .wk-days { display: flex; }
    .d { display: flex; align-items: center; justify-content: center; }
    .rows { position: relative; } .we-col { position: absolute; top: 0; bottom: 0; }
    .bar { position: absolute; display: flex; align-items: center; padding: 0 8px; white-space: nowrap; overflow: hidden; } .bar .pg { position: absolute; left: 0; top: 0; bottom: 0; } .bar span { position: relative; }
    .float { position: absolute; } .ms { position: absolute; width: 16px; height: 16px; transform: rotate(45deg); }
    .today { position: absolute; top: 0; bottom: 0; width: 2px; } .today-tag { position: absolute; top: 4px; left: 6px; font-size: 10px; font-weight: 600; white-space: nowrap; }
    .seg { display: flex; } .seg span { display: flex; align-items: center; }
    .nav { display: flex; align-items: center; gap: 10px; }
    .tl { flex: 1; position: relative; overflow: hidden; } .days { display: flex; }
${d.css}
  </style>
</helmet>
<div class="app">
  <div class="side">
    <div class="brand"><div class="brand-mark"></div><div class="brand-name">แผนงาน</div></div>
    <div class="nav">${icons.proj}<span>โปรเจกต์</span></div>
    <div class="nav on">${icons.gantt}<span>Gantt</span></div>
    <div class="nav">${icons.cal}<span>ปฏิทิน</span></div>
    <div class="nav">${icons.res}<span>ทรัพยากร</span></div>
  </div>
  <div class="main">
    <div class="top">
      <div class="title"><div class="crumb">โปรเจกต์ › ระบบจองห้องประชุม</div><h1>Gantt</h1></div>
      <div class="seg"><span class="on">วัน</span><span>สัปดาห์</span><span>เดือน</span></div>
      <div class="spacer"></div>
      <div class="chip">Critical path · 4 งาน</div>
      <div class="chip soft">กำหนดเสร็จ 6 ต.ค. 2569</div>
      <div class="btn primary">${plus}<span>เพิ่มงาน</span></div>
    </div>
    <div class="body">
      <div class="tbl">${table(d)}</div>
      <div class="tl">
        <div class="days">${tl.days}</div>
        <div class="rows" style="height:${(tasks.length + 1) * d.row}px">${tl.rows}${tl.svg}${tl.bars}</div>
      </div>
    </div>
    <div class="foot"><span class="tag">แบบ ${d.letter}</span><strong>${d.title}</strong><span class="desc">${d.desc}</span></div>
  </div>
</div>
</x-dc>
</body>
</html>
`;
}

// ---------- directions ----------
const D = [];

D.push({
  letter: 'A', file: 'Main.dc.html', title: 'เรียบ ใช้งานจริง', desc: 'โทนเทาเย็น สีเน้นเขียวน้ำทะเล แดงสำหรับ critical · เน้นอ่านง่าย ใช้ทั้งวันไม่ล้า',
  fontLink: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600&amp;display=swap',
  row: 40, day: 30, barH: 22, stroke: 1.5, crit: '#c8453d', link: '#8a9aa6',
  css: `
    body { font-family: "IBM Plex Sans Thai", "Segoe UI", Tahoma, sans-serif; color: #1c2128; background: #f3f4f6; font-size: 13px; }
    a { color: #0f7b8a; } a:hover { color: #0a5b66; }
    .app { display: flex; width: 1280px; height: 720px; background: #f3f4f6; overflow: hidden; }
    .side { width: 200px; background: #ffffff; border-right: 1px solid #e3e6ea; padding: 20px 12px; display: flex; flex-direction: column; gap: 4px; }
    .brand { display: flex; align-items: center; gap: 10px; padding: 4px 8px 20px; } .brand-mark { width: 26px; height: 26px; border-radius: 6px; background: #0f7b8a; } .brand-name { font-weight: 600; font-size: 16px; }
    .nav { height: 40px; padding: 0 10px; border-radius: 6px; color: #4b5563; font-weight: 500; } .nav.on { background: #e3f2f4; color: #0a5b66; }
    .main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .top { height: 60px; display: flex; align-items: center; gap: 12px; padding: 0 20px; background: #ffffff; border-bottom: 1px solid #e3e6ea; }
    .crumb { font-size: 12px; color: #6b7280; } h1 { margin: 0; font-size: 17px; font-weight: 600; line-height: 1.2; }
    .seg { border: 1px solid #d5d9df; border-radius: 6px; overflow: hidden; height: 32px; margin-left: 12px; } .seg span { padding: 0 14px; color: #4b5563; background: #ffffff; border-right: 1px solid #d5d9df; } .seg span:last-child { border-right: 0; } .seg span.on { background: #1c2128; color: #ffffff; }
    .spacer { flex: 1; }
    .chip { height: 26px; padding: 0 10px; border-radius: 999px; font-size: 12px; font-weight: 500; background: #fbe9e7; color: #a4261e; display: flex; align-items: center; } .chip.soft { background: #eceef1; color: #4b5563; }
    .btn { height: 32px; padding: 0 12px; border-radius: 6px; display: flex; align-items: center; gap: 6px; font-weight: 500; background: #0f7b8a; color: #ffffff; }
    .body { flex: 1; display: flex; background: #ffffff; min-height: 0; }
    .tbl { width: 360px; border-right: 1px solid #e3e6ea; }
    .tr { border-bottom: 1px solid #eef0f2; padding-left: 12px; padding-right: 10px; } .tr.head { height: 56px; background: #f9fafb; font-size: 12px; color: #6b7280; font-weight: 500; }
    .c1 { color: #9ca3af; } .dot { background: #9fb9c6; } .dot.crit { background: #c8453d; } .dot.ms { background: #1c2128; border-radius: 1px; transform: rotate(45deg); } .c6.crit { color: #a4261e; font-weight: 600; }
    .days { height: 56px; background: #f9fafb; border-bottom: 1px solid #e3e6ea; } .wk { border-right: 1px solid #e3e6ea; } .wk-name { height: 26px; display: flex; align-items: center; padding: 0 8px; font-size: 12px; font-weight: 500; color: #4b5563; border-bottom: 1px solid #eef0f2; } .d { height: 30px; font-size: 11px; color: #6b7280; } .d.we { color: #b0b6bf; background: #f1f2f4; }
    .grid-row { height: 40px; border-bottom: 1px solid #eef0f2; } .we-col { background: #f6f7f8; }
    .bar { border-radius: 4px; background: #9fb9c6; color: #ffffff; font-size: 11px; font-weight: 500; } .bar.crit { background: #c8453d; } .pg { background: rgba(0,0,0,0.18); }
    .float { border: 1px dashed #b7c6cf; border-left: 0; border-radius: 0 4px 4px 0; } .ms { background: #1c2128; border-radius: 2px; }
    .today { background: #0f7b8a; } .today-tag { color: #0f7b8a; }
    .foot { height: 44px; display: flex; align-items: center; gap: 12px; padding: 0 20px; border-top: 1px solid #e3e6ea; background: #ffffff; font-size: 12px; color: #4b5563; } .tag { background: #1c2128; color: #ffffff; padding: 2px 8px; border-radius: 4px; font-weight: 600; } .foot strong { color: #1c2128; }
  `,
});

D.push({
  letter: 'B', file: 'DirectionB.dc.html', title: 'มืด หนาแน่น สายข้อมูล', desc: 'พื้นหลังเข้ม แถวแคบ ตัวเลขแบบ mono สีเหลืองอำพันสำหรับ critical · เห็นงานได้มากในจอเดียว',
  fontLink: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600&amp;family=JetBrains+Mono:wght@400;600&amp;display=swap',
  row: 32, day: 30, barH: 18, stroke: 1.25, crit: '#f2b035', link: '#5b6572',
  css: `
    body { font-family: "Noto Sans Thai", "Segoe UI", Tahoma, sans-serif; color: #e6e9ee; background: #0f1216; font-size: 12px; }
    a { color: #f2b035; } a:hover { color: #ffcf6b; }
    .app { display: flex; width: 1280px; height: 720px; background: #0f1216; overflow: hidden; }
    .side { width: 180px; background: #0b0e11; border-right: 1px solid #1f242b; padding: 16px 8px; display: flex; flex-direction: column; gap: 2px; }
    .brand { display: flex; align-items: center; gap: 8px; padding: 4px 8px 18px; } .brand-mark { width: 22px; height: 22px; border-radius: 3px; background: #f2b035; } .brand-name { font-weight: 600; font-size: 14px; letter-spacing: 0.04em; }
    .nav { height: 34px; padding: 0 10px; border-radius: 4px; color: #8b95a3; font-size: 12px; } .nav.on { background: #1a2028; color: #f2b035; }
    .main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .top { height: 48px; display: flex; align-items: center; gap: 10px; padding: 0 16px; background: #0b0e11; border-bottom: 1px solid #1f242b; }
    .crumb { font-size: 11px; color: #6b7480; } h1 { margin: 0; font-size: 14px; font-weight: 600; line-height: 1.2; }
    .seg { border: 1px solid #2a313b; border-radius: 4px; overflow: hidden; height: 28px; margin-left: 10px; font-family: "JetBrains Mono", monospace; font-size: 11px; } .seg span { padding: 0 12px; color: #8b95a3; background: #14181e; border-right: 1px solid #2a313b; } .seg span:last-child { border-right: 0; } .seg span.on { background: #f2b035; color: #0f1216; font-weight: 600; }
    .spacer { flex: 1; }
    .chip { height: 24px; padding: 0 10px; border-radius: 3px; font-size: 11px; font-family: "JetBrains Mono", monospace; background: #2b230f; color: #f2b035; display: flex; align-items: center; border: 1px solid #4a3a12; } .chip.soft { background: #14181e; color: #8b95a3; border-color: #2a313b; }
    .btn { height: 28px; padding: 0 12px; border-radius: 4px; display: flex; align-items: center; gap: 6px; font-weight: 600; background: #e6e9ee; color: #0f1216; }
    .body { flex: 1; display: flex; background: #0f1216; min-height: 0; }
    .tbl { width: 340px; border-right: 1px solid #1f242b; }
    .tr { border-bottom: 1px solid #1a1f26; padding-left: 10px; padding-right: 10px; } .tr.head { height: 48px; background: #0b0e11; font-size: 11px; color: #6b7480; font-family: "JetBrains Mono", monospace; text-transform: uppercase; letter-spacing: 0.06em; }
    .c1 { color: #4b5563; font-family: "JetBrains Mono", monospace; } .c3, .c4, .c5, .c6 { font-family: "JetBrains Mono", monospace; font-size: 11px; color: #a4adb9; }
    .dot { background: #3f6f8f; } .dot.crit { background: #f2b035; } .dot.ms { background: #e6e9ee; border-radius: 1px; transform: rotate(45deg); } .c6.crit { color: #f2b035; font-weight: 600; }
    .days { height: 48px; background: #0b0e11; border-bottom: 1px solid #1f242b; } .wk { border-right: 1px solid #1f242b; } .wk-name { height: 22px; display: flex; align-items: center; padding: 0 8px; font-size: 11px; color: #8b95a3; border-bottom: 1px solid #1a1f26; } .d { height: 26px; font-size: 10px; color: #6b7480; font-family: "JetBrains Mono", monospace; } .d.we { color: #3b424c; background: #0d1014; }
    .grid-row { height: 32px; border-bottom: 1px solid #1a1f26; } .we-col { background: #12161b; }
    .bar { border-radius: 2px; background: #3f6f8f; color: #e6e9ee; font-size: 10px; } .bar.crit { background: #f2b035; color: #0f1216; font-weight: 600; } .pg { background: rgba(255,255,255,0.18); }
    .float { border: 1px dashed #3b4653; border-left: 0; } .ms { background: #e6e9ee; }
    .today { background: #4cc9f0; } .today-tag { color: #4cc9f0; font-family: "JetBrains Mono", monospace; }
    .foot { height: 40px; display: flex; align-items: center; gap: 12px; padding: 0 16px; border-top: 1px solid #1f242b; background: #0b0e11; font-size: 11px; color: #8b95a3; } .tag { background: #f2b035; color: #0f1216; padding: 2px 8px; border-radius: 3px; font-weight: 700; font-family: "JetBrains Mono", monospace; } .foot strong { color: #e6e9ee; }
  `,
});

D.push({
  letter: 'C', file: 'DirectionC.dc.html', title: 'กระดาษ บรรณาธิการ', desc: 'พื้นสีครีม หัวเรื่องเซอริฟ เส้นบางสีหมึก แดงอิฐสำหรับ critical · โปร่ง สงบ เหมือนตารางงานบนกระดาษ',
  fontLink: 'https://fonts.googleapis.com/css2?family=Noto+Serif+Thai:wght@500;600&amp;family=Sarabun:wght@400;500;600&amp;display=swap',
  row: 44, day: 30, barH: 14, stroke: 1.2, crit: '#a8412f', link: '#8c857a',
  css: `
    body { font-family: "Sarabun", "Segoe UI", Tahoma, sans-serif; color: #2b2723; background: #f6f1e8; font-size: 13px; }
    a { color: #a8412f; } a:hover { color: #7d2f22; }
    .app { display: flex; width: 1280px; height: 720px; background: #f6f1e8; overflow: hidden; }
    .side { width: 200px; background: #f6f1e8; border-right: 1px solid #d9d0c1; padding: 28px 16px; display: flex; flex-direction: column; gap: 6px; }
    .brand { display: flex; align-items: center; gap: 10px; padding: 0 4px 28px; } .brand-mark { width: 10px; height: 10px; border-radius: 999px; background: #a8412f; } .brand-name { font-family: "Noto Serif Thai", Georgia, serif; font-weight: 600; font-size: 20px; }
    .nav { height: 36px; padding: 0 6px; color: #6f6659; border-bottom: 1px solid transparent; } .nav.on { color: #2b2723; border-bottom: 1px solid #2b2723; font-weight: 500; }
    .main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .top { height: 84px; display: flex; align-items: flex-end; gap: 14px; padding: 0 28px 16px; border-bottom: 1px solid #2b2723; }
    .crumb { font-size: 12px; color: #8c857a; letter-spacing: 0.04em; } h1 { margin: 0; font-family: "Noto Serif Thai", Georgia, serif; font-size: 28px; font-weight: 600; line-height: 1.1; }
    .seg { height: 30px; margin-left: 16px; gap: 2px; align-self: flex-end; } .seg span { padding: 0 12px; color: #6f6659; border-bottom: 2px solid transparent; } .seg span.on { color: #2b2723; border-bottom-color: #a8412f; font-weight: 600; }
    .spacer { flex: 1; }
    .chip { height: 28px; padding: 0 2px; font-size: 12px; color: #a8412f; display: flex; align-items: center; font-weight: 600; letter-spacing: 0.02em; } .chip.soft { color: #6f6659; font-weight: 400; margin-left: 10px; }
    .btn { height: 34px; padding: 0 16px; border-radius: 999px; display: flex; align-items: center; gap: 6px; font-weight: 600; background: #2b2723; color: #f6f1e8; margin-left: 12px; }
    .body { flex: 1; display: flex; min-height: 0; padding: 0 28px; }
    .tbl { width: 360px; border-right: 1px solid #d9d0c1; }
    .tr { border-bottom: 1px solid #e6dfd2; padding-right: 14px; } .tr.head { height: 56px; font-size: 11px; color: #8c857a; letter-spacing: 0.08em; text-transform: uppercase; }
    .c1 { color: #b5ad9f; font-family: "Noto Serif Thai", Georgia, serif; } .c2 { font-size: 14px; }
    .dot { width: 6px; height: 6px; background: #8c857a; } .dot.crit { background: #a8412f; } .dot.ms { background: #2b2723; border-radius: 0; transform: rotate(45deg); } .c6.crit { color: #a8412f; font-weight: 600; }
    .days { height: 56px; border-bottom: 1px solid #d9d0c1; } .wk { border-right: 1px solid #e6dfd2; } .wk-name { height: 28px; display: flex; align-items: center; padding: 0 8px; font-size: 12px; color: #2b2723; font-family: "Noto Serif Thai", Georgia, serif; } .d { height: 28px; font-size: 11px; color: #8c857a; } .d.we { color: #c4bcae; }
    .grid-row { height: 44px; border-bottom: 1px solid #e6dfd2; } .we-col { background: repeating-linear-gradient(135deg, transparent 0 5px, #ece5d8 5px 6px); }
    .bar { border-radius: 999px; background: #8c857a; color: #f6f1e8; font-size: 10px; padding: 0 10px; } .bar.crit { background: #a8412f; } .pg { background: rgba(0,0,0,0.2); }
    .float { border-bottom: 1px dotted #8c857a; height: 8px !important; margin-top: 3px; } .ms { background: #2b2723; }
    .today { background: #2b2723; width: 1px; } .today-tag { color: #2b2723; font-family: "Noto Serif Thai", Georgia, serif; font-style: italic; font-weight: 500; }
    .foot { height: 48px; display: flex; align-items: center; gap: 12px; padding: 0 28px; border-top: 1px solid #d9d0c1; font-size: 12px; color: #6f6659; } .tag { font-family: "Noto Serif Thai", Georgia, serif; color: #a8412f; font-weight: 600; font-size: 14px; } .foot strong { color: #2b2723; }
  `,
});

D.push({
  letter: 'D', file: 'DirectionD.dc.html', title: 'สดใส เป็นมิตร', desc: 'การ์ดมุมโค้ง เงานุ่ม สีม่วงเป็นสีหลัก แถบงานสีพาสเทล ชมพูเข้มสำหรับ critical · ดูสบาย เหมาะทีมเล็ก',
  fontLink: 'https://fonts.googleapis.com/css2?family=Kanit:wght@400;500;600&amp;display=swap',
  row: 44, day: 30, barH: 26, stroke: 2, crit: '#e0457b', link: '#b7b1d6',
  css: `
    body { font-family: "Kanit", "Segoe UI", Tahoma, sans-serif; color: #2f2a4a; background: #f2f0fa; font-size: 13px; }
    a { color: #6a4fd8; } a:hover { color: #4e37b0; }
    .app { display: flex; width: 1280px; height: 720px; background: #f2f0fa; overflow: hidden; gap: 16px; padding: 16px; }
    .side { width: 188px; background: #6a4fd8; border-radius: 18px; padding: 20px 12px; display: flex; flex-direction: column; gap: 6px; color: #ffffff; }
    .brand { display: flex; align-items: center; gap: 10px; padding: 4px 8px 22px; } .brand-mark { width: 30px; height: 30px; border-radius: 10px; background: #ffd166; } .brand-name { font-weight: 600; font-size: 17px; }
    .nav { height: 42px; padding: 0 12px; border-radius: 12px; color: #d9d2f7; font-weight: 400; } .nav.on { background: #ffffff; color: #4e37b0; font-weight: 500; }
    .main { flex: 1; display: flex; flex-direction: column; min-width: 0; gap: 12px; }
    .top { height: 60px; display: flex; align-items: center; gap: 12px; padding: 0 8px; }
    .crumb { font-size: 12px; color: #8a83a8; } h1 { margin: 0; font-size: 20px; font-weight: 600; line-height: 1.2; }
    .seg { background: #ffffff; border-radius: 999px; padding: 4px; height: 40px; margin-left: 12px; box-shadow: 0 1px 2px rgba(47,42,74,0.06); } .seg span { padding: 0 16px; border-radius: 999px; color: #6f6893; } .seg span.on { background: #6a4fd8; color: #ffffff; font-weight: 500; }
    .spacer { flex: 1; }
    .chip { height: 30px; padding: 0 12px; border-radius: 999px; font-size: 12px; font-weight: 500; background: #ffe0ec; color: #b8285a; display: flex; align-items: center; } .chip.soft { background: #ffffff; color: #6f6893; }
    .btn { height: 40px; padding: 0 16px; border-radius: 999px; display: flex; align-items: center; gap: 6px; font-weight: 500; background: #2f2a4a; color: #ffffff; box-shadow: 0 6px 16px rgba(47,42,74,0.18); }
    .body { flex: 1; display: flex; background: #ffffff; border-radius: 18px; min-height: 0; overflow: hidden; box-shadow: 0 2px 8px rgba(47,42,74,0.06); }
    .tbl { width: 360px; border-right: 1px solid #ece9f6; }
    .tr { border-bottom: 1px solid #f1eff8; padding-left: 16px; padding-right: 12px; } .tr.head { height: 56px; font-size: 12px; color: #8a83a8; font-weight: 500; }
    .c1 { color: #b7b1d6; } .dot { width: 10px; height: 10px; background: #8fd3c7; } .dot.crit { background: #e0457b; } .dot.ms { background: #ffd166; border-radius: 2px; transform: rotate(45deg); } .c6.crit { color: #b8285a; font-weight: 600; }
    .days { height: 56px; border-bottom: 1px solid #ece9f6; } .wk { border-right: 1px solid #ece9f6; } .wk-name { height: 26px; display: flex; align-items: center; padding: 0 10px; font-size: 12px; font-weight: 500; color: #4e37b0; } .d { height: 30px; font-size: 11px; color: #8a83a8; } .d.we { color: #c9c4e0; }
    .grid-row { height: 44px; border-bottom: 1px solid #f1eff8; } .we-col { background: #f7f5fc; }
    .bar { border-radius: 999px; background: #8fd3c7; color: #1f4d45; font-size: 11px; font-weight: 500; padding: 0 12px; } .bar.crit { background: #e0457b; color: #ffffff; } .pg { background: rgba(0,0,0,0.12); }
    .float { border: 2px dashed #d6d1ea; border-left: 0; border-radius: 0 999px 999px 0; } .ms { background: #ffd166; border-radius: 4px; }
    .today { background: #6a4fd8; border-radius: 2px; } .today-tag { color: #6a4fd8; }
    .foot { height: 44px; display: flex; align-items: center; gap: 12px; padding: 0 8px; font-size: 12px; color: #6f6893; } .tag { background: #6a4fd8; color: #ffffff; padding: 2px 10px; border-radius: 999px; font-weight: 500; } .foot strong { color: #2f2a4a; }
  `,
});

D.push({
  letter: 'E', file: 'DirectionE.dc.html', title: 'โครงร่างหนา ตรงไปตรงมา', desc: 'ขอบดำหนา ไม่มีมุมโค้ง ไม่มีเงา สีเหลืองไฮไลต์ critical ตัวอักษรใหญ่ · ชัด แรง ไม่มีอะไรซ่อน',
  fontLink: 'https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&amp;family=Bai+Jamjuree:wght@400;500;600&amp;display=swap',
  row: 40, day: 30, barH: 24, stroke: 2, crit: '#111111', link: '#111111',
  css: `
    body { font-family: "Bai Jamjuree", "Segoe UI", Tahoma, sans-serif; color: #111111; background: #ffffff; font-size: 13px; }
    a { color: #111111; } a:hover { color: #444444; }
    .app { display: flex; width: 1280px; height: 720px; background: #ffffff; overflow: hidden; border: 3px solid #111111; }
    .side { width: 200px; background: #ffffff; border-right: 3px solid #111111; padding: 0; display: flex; flex-direction: column; }
    .brand { display: flex; align-items: center; gap: 10px; padding: 18px 16px; border-bottom: 3px solid #111111; background: #111111; color: #ffffff; } .brand-mark { width: 14px; height: 14px; background: #ffe600; } .brand-name { font-family: "Chakra Petch", sans-serif; font-weight: 700; font-size: 18px; letter-spacing: 0.06em; }
    .nav { height: 44px; padding: 0 16px; border-bottom: 2px solid #111111; color: #111111; font-weight: 500; font-size: 14px; } .nav.on { background: #ffe600; font-weight: 600; }
    .main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .top { height: 64px; display: flex; align-items: center; gap: 12px; padding: 0 20px; border-bottom: 3px solid #111111; }
    .crumb { font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; } h1 { margin: 0; font-family: "Chakra Petch", sans-serif; font-size: 22px; font-weight: 700; line-height: 1.1; text-transform: uppercase; }
    .seg { border: 2px solid #111111; height: 34px; margin-left: 12px; } .seg span { padding: 0 14px; border-right: 2px solid #111111; font-weight: 600; } .seg span:last-child { border-right: 0; } .seg span.on { background: #111111; color: #ffe600; }
    .spacer { flex: 1; }
    .chip { height: 30px; padding: 0 10px; font-size: 12px; font-weight: 700; background: #ffe600; color: #111111; display: flex; align-items: center; border: 2px solid #111111; font-family: "Chakra Petch", sans-serif; } .chip.soft { background: #ffffff; font-weight: 500; }
    .btn { height: 34px; padding: 0 14px; display: flex; align-items: center; gap: 6px; font-weight: 700; background: #111111; color: #ffffff; border: 2px solid #111111; font-family: "Chakra Petch", sans-serif; }
    .body { flex: 1; display: flex; min-height: 0; }
    .tbl { width: 360px; border-right: 3px solid #111111; }
    .tr { border-bottom: 1px solid #111111; padding-left: 12px; padding-right: 12px; } .tr.head { height: 56px; background: #f0f0f0; font-family: "Chakra Petch", sans-serif; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 3px solid #111111; }
    .tr.crit { background: #fff9c2; } .c1 { font-family: "Chakra Petch", sans-serif; font-weight: 600; } .c2 { font-weight: 500; }
    .dot { width: 10px; height: 10px; border-radius: 0; background: #ffffff; border: 2px solid #111111; } .dot.crit { background: #ffe600; } .dot.ms { background: #111111; transform: rotate(45deg); } .c6.crit { font-weight: 700; }
    .days { height: 56px; background: #f0f0f0; border-bottom: 3px solid #111111; } .wk { border-right: 2px solid #111111; } .wk-name { height: 26px; display: flex; align-items: center; padding: 0 8px; font-size: 12px; font-weight: 700; font-family: "Chakra Petch", sans-serif; border-bottom: 1px solid #111111; } .d { height: 30px; font-size: 11px; font-weight: 600; } .d.we { color: #888888; background: repeating-linear-gradient(135deg, transparent 0 4px, #dddddd 4px 5px); }
    .grid-row { height: 40px; border-bottom: 1px solid #111111; } .we-col { background: repeating-linear-gradient(135deg, transparent 0 4px, #eeeeee 4px 5px); }
    .bar { border: 2px solid #111111; background: #ffffff; color: #111111; font-size: 11px; font-weight: 600; } .bar.crit { background: #ffe600; font-weight: 700; } .pg { background: rgba(17,17,17,0.15); }
    .float { border: 2px dashed #111111; border-left: 0; } .ms { background: #111111; }
    .today { background: #111111; width: 3px; } .today-tag { color: #111111; font-family: "Chakra Petch", sans-serif; text-transform: uppercase; }
    .foot { height: 44px; display: flex; align-items: center; gap: 12px; padding: 0 20px; border-top: 3px solid #111111; font-size: 12px; } .tag { background: #111111; color: #ffe600; padding: 2px 8px; font-weight: 700; font-family: "Chakra Petch", sans-serif; } .foot strong { font-weight: 700; }
  `,
});

for (const d of D) { writeFileSync(d.file, page(d)); console.log('built', d.file); }

const canvas = {
  artboards: [
    { file: 'Main.dc.html', title: 'แบบ A · เรียบ ใช้งานจริง', x: 0, y: 0, w: 1280, h: 720 },
    { file: 'DirectionB.dc.html', title: 'แบบ B · มืด หนาแน่น', x: 1380, y: 0, w: 1280, h: 720 },
    { file: 'DirectionC.dc.html', title: 'แบบ C · กระดาษ บรรณาธิการ', x: 0, y: 860, w: 1280, h: 720 },
    { file: 'DirectionD.dc.html', title: 'แบบ D · สดใส เป็นมิตร', x: 1380, y: 860, w: 1280, h: 720 },
    { file: 'DirectionE.dc.html', title: 'แบบ E · โครงร่างหนา', x: 0, y: 1720, w: 1280, h: 720 },
  ],
  annotations: [
    { id: 'how-to-pick', x: 1380, y: 1720, w: 520, text: 'แนวทาง 5 แบบ ใช้หน้า Gantt เดียวกันเป็นตัวเปรียบเทียบ\n\nA เรียบ ใช้งานจริง – ปลอดภัยสุด ใช้ทั้งวันไม่ล้า แต่เอกลักษณ์น้อย\nB มืด หนาแน่น – เห็นงานได้มากที่สุดต่อจอ เหมาะสายวิเคราะห์ แต่พิมพ์/แชร์ยาก\nC กระดาษ บรรณาธิการ – สงบ สวย เหมาะโปรเจกต์ไม่กี่สิบงาน แต่เปลืองพื้นที่\nD สดใส เป็นมิตร – ดูสบาย ทีมเล็กชอบ แต่ข้อมูลหนาแน่นแล้วจะรก\nE โครงร่างหนา – ชัดแรง จำง่าย แต่ตาล้าเร็วเมื่อใช้นาน\n\nเลือกได้ 1 แบบ หรือผสมได้ เช่น โครงของ A + ความหนาแน่นของ B' },
  ],
  launch: { view: 'canvas' },
};
writeFileSync('canvas.json', JSON.stringify(canvas, null, 2));
console.log('built canvas.json');
