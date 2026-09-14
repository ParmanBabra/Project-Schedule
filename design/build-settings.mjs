import { writeFileSync } from 'node:fs';

const icon = (p, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const I = {
  gantt: (s) => icon('<path d="M4 6h8"></path><path d="M9 12h9"></path><path d="M6 18h7"></path>', s),
  cal: (s) => icon('<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M3 10h18"></path><path d="M8 3v4"></path><path d="M16 3v4"></path>', s),
  res: (s) => icon('<circle cx="9" cy="8" r="3.5"></circle><path d="M2.5 20a6.5 6.5 0 0 1 13 0"></path><path d="M16 4.5a3.5 3.5 0 0 1 0 7"></path><path d="M17.5 14a6 6 0 0 1 4 6"></path>', s),
  chev: (s) => icon('<path d="M6 9l6 6 6-6"></path>', s),
  back: (s) => icon('<path d="M15 6l-6 6 6 6"></path>', s),
  check: (s) => icon('<path d="M5 12l5 5L20 7"></path>', s),
  info: (s) => icon('<circle cx="12" cy="12" r="9"></circle><path d="M12 11v5"></path><path d="M12 8h.01"></path>', s),
  plus: (s) => icon('<path d="M12 5v14"></path><path d="M5 12h14"></path>', s),
  list: (s) => icon('<path d="M4 6h16"></path><path d="M4 12h16"></path><path d="M4 18h16"></path>', s),
  caret: (s) => icon('<path d="M9 6l6 6-6 6"></path>', s),
  caretDown: (s) => icon('<path d="M6 9l6 6 6-6"></path>', s),
  gear: (s) => icon('<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"></path>', s),
};

const css = `
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Kanit", "Segoe UI", Tahoma, sans-serif; color: #2f2a4a; background: #f2f0fa; font-size: 13px; }
    a { color: #6a4fd8; } a:hover { color: #4e37b0; }
    h1 { margin: 0; font-size: 20px; font-weight: 600; line-height: 1.2; } h2 { margin: 0; font-size: 16px; font-weight: 600; } h3 { margin: 0; font-size: 14px; font-weight: 600; }
    .crumb { font-size: 12px; color: #8a83a8; } .muted { color: #6f6893; } .faint { color: #b7b1d6; font-size: 11px; }
    .hbar { height: 60px; background: #6a4fd8; border-radius: 18px; display: flex; align-items: center; gap: 16px; padding: 0 20px; color: #ffffff; flex-shrink: 0; }
    .brand { display: flex; align-items: center; gap: 10px; } .brand-mark { width: 30px; height: 30px; border-radius: 10px; background: #ffd166; flex-shrink: 0; } .brand-name { font-weight: 600; font-size: 17px; }
    .switch { display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 14px; border-radius: 999px; background: rgba(255,255,255,0.14); font-weight: 500; }
    .tabs { display: flex; gap: 4px; margin-left: 12px; } .tabs span { display: flex; align-items: center; gap: 8px; height: 38px; padding: 0 16px; border-radius: 999px; color: #d9d2f7; } .tabs span.on { background: #ffffff; color: #4e37b0; font-weight: 500; }
    .spacer { flex: 1; }
    .av { width: 34px; height: 34px; border-radius: 999px; background: #ffd166; color: #2f2a4a; font-weight: 500; display: flex; align-items: center; justify-content: center; }
    .chip { height: 30px; padding: 0 12px; border-radius: 999px; font-size: 12px; font-weight: 500; background: #ffe0ec; color: #b8285a; display: inline-flex; align-items: center; gap: 6px; } .chip.soft { background: #ffffff; color: #6f6893; } .chip.green { background: #dff3ee; color: #136b5c; } .chip.primary { background: #e6e1fb; color: #4e37b0; }
    .btn { height: 40px; padding: 0 16px; border-radius: 999px; display: inline-flex; align-items: center; gap: 6px; font-weight: 500; background: #ffffff; color: #2f2a4a; } .btn.primary { background: #2f2a4a; color: #ffffff; box-shadow: 0 6px 16px rgba(47,42,74,0.18); } .btn.sm { height: 36px; }
    .seg { display: inline-flex; background: #f2f0fa; border-radius: 999px; padding: 4px; height: 36px; } .seg span { display: flex; align-items: center; padding: 0 14px; border-radius: 999px; color: #6f6893; font-size: 12px; } .seg span.on { background: #6a4fd8; color: #ffffff; font-weight: 500; }
    .seg.white { background: #ffffff; height: 40px; box-shadow: 0 1px 2px rgba(47,42,74,0.06); }
    .card { background: #ffffff; border-radius: 18px; box-shadow: 0 2px 8px rgba(47,42,74,0.06); }
    /* settings */
    .page { flex: 1; overflow: hidden; display: flex; justify-content: center; align-items: flex-start; }
    .sheet { width: 760px; display: flex; flex-direction: column; gap: 16px; }
    .sec { padding: 20px 24px; display: flex; flex-direction: column; gap: 14px; }
    .sec-head { display: flex; align-items: baseline; gap: 10px; } .sec-head p { margin: 0; color: #6f6893; font-size: 12px; }
    .daybtns { display: flex; gap: 8px; } .db { width: 44px; height: 40px; border-radius: 999px; background: #f2f0fa; color: #8a83a8; display: flex; align-items: center; justify-content: center; font-weight: 500; } .db.on { background: #6a4fd8; color: #ffffff; }
    .hol { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; } .hol .chip { height: 32px; }
    .opts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .opt { border-radius: 16px; background: #f7f5fc; padding: 16px; display: flex; flex-direction: column; gap: 10px; position: relative; border: 2px solid transparent; }
    .opt.on { background: #ffffff; border-color: #6a4fd8; box-shadow: 0 2px 8px rgba(47,42,74,0.06); }
    .opt .tick { position: absolute; top: 12px; right: 12px; width: 24px; height: 24px; border-radius: 999px; background: #6a4fd8; color: #ffffff; display: flex; align-items: center; justify-content: center; }
    .opt .rec { display: inline-flex; height: 22px; padding: 0 8px; border-radius: 999px; background: #ffd166; color: #2f2a4a; font-size: 11px; font-weight: 500; align-items: center; align-self: flex-start; }
    .opt p { margin: 0; font-size: 13px; line-height: 1.5; } .opt .fit { font-size: 12px; color: #6f6893; line-height: 1.5; }
    .opt .seg, .mopt .seg { display: flex; width: 100%; height: 34px; } .opt .seg span, .mopt .seg span { flex: 1; justify-content: center; padding: 0 4px; white-space: nowrap; font-size: 11px; }
    .ex { border-radius: 12px; background: #f2f0fa; padding: 10px 12px; font-size: 12px; line-height: 1.5; } .opt.on .ex { background: #e6e1fb; color: #4e37b0; } .ex b { font-weight: 600; }
    .slider { display: flex; align-items: center; gap: 10px; font-size: 12px; color: #6f6893; } .track { flex: 1; height: 6px; border-radius: 999px; background: #e6e1fb; position: relative; } .track { margin: 0 10px 0 0; } .track .fill { position: absolute; left: 0; top: 0; bottom: 0; width: 100%; background: #6a4fd8; border-radius: 999px; } .track .knob { position: absolute; top: -7px; right: -2px; width: 20px; height: 20px; border-radius: 999px; background: #ffffff; border: 2px solid #6a4fd8; box-sizing: border-box; } .slider b { width: 34px; text-align: right; flex-shrink: 0; }
    .mr { display: flex; align-items: center; gap: 12px; font-size: 12px; color: #6f6893; } .mr .num { height: 36px; width: 84px; border-radius: 12px; background: #f2f0fa; display: flex; align-items: center; justify-content: space-between; padding: 0 12px; color: #2f2a4a; font-size: 13px; }
    .rule { display: flex; gap: 16px; padding: 14px 16px; border-radius: 16px; background: #f7f5fc; align-items: flex-start; } .rule.off { opacity: 0.5; }
    .rule .rl { width: 200px; flex-shrink: 0; display: flex; flex-direction: column; gap: 4px; } .rule .rl h3 { display: flex; align-items: center; gap: 6px; } .rule .rl h3 svg { color: #b7b1d6; }
    .rule .rr { flex: 1; display: flex; flex-direction: column; gap: 8px; } .rule .rr p { margin: 0; font-size: 12px; color: #6f6893; line-height: 1.5; } .rule .rr .ex { align-self: flex-start; }
    .danger { display: flex; align-items: center; gap: 10px; } .danger .btn { background: #f2f0fa; color: #b8285a; }
    /* gantt bits */
    .tool { height: 44px; display: flex; align-items: center; gap: 8px; padding: 0 8px; flex-shrink: 0; }
    .gantt { display: flex; flex: 1; min-height: 0; background: #ffffff; border-radius: 18px; box-shadow: 0 2px 8px rgba(47,42,74,0.06); overflow: hidden; }
    .tbl { width: 240px; flex-shrink: 0; border-right: 1px solid #ece9f6; }
    .tr { display: flex; align-items: center; height: 40px; border-bottom: 1px solid #f1eff8; padding: 0 12px 0 12px; gap: 8px; font-size: 13px; } .tr.head { height: 56px; font-size: 12px; color: #8a83a8; font-weight: 500; }
    .tr .wbs { width: 30px; color: #b7b1d6; font-size: 11px; font-variant-numeric: tabular-nums; flex-shrink: 0; } .tr .nm { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 6px; } .tr.sum .nm { font-weight: 500; } .tr .car { color: #8a83a8; display: flex; } .tr.l1 .nm { padding-left: 16px; }
    .dot { width: 10px; height: 10px; border-radius: 999px; background: #8fd3c7; flex-shrink: 0; } .dot.crit { background: #e0457b; } .dot.ms { background: #ffd166; border-radius: 2px; transform: rotate(45deg); } .dot.buf { background: transparent; border: 2px dashed #e0457b; width: 8px; height: 8px; }
    .tl { flex: 1; position: relative; overflow: hidden; }
    .days { display: flex; height: 56px; border-bottom: 1px solid #ece9f6; } .wk { display: flex; flex-direction: column; flex-shrink: 0; border-right: 1px solid #ece9f6; } .wk-name { height: 26px; display: flex; align-items: center; padding: 0 8px; font-size: 12px; font-weight: 500; color: #4e37b0; white-space: nowrap; } .wk-days { display: flex; } .d { height: 30px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #8a83a8; } .d.we { color: #c9c4e0; }
    .rows { position: relative; } .grid-row { height: 40px; border-bottom: 1px solid #f1eff8; } .we-col { position: absolute; top: 0; bottom: 0; background: #f7f5fc; }
    .bar { position: absolute; height: 24px; border-radius: 999px; background: #8fd3c7; overflow: hidden; display: flex; align-items: center; padding: 0 10px; font-size: 11px; color: #1f4d45; font-weight: 500; white-space: nowrap; } .bar.crit { background: #e0457b; color: #ffffff; } .bar .pg { position: absolute; left: 0; top: 0; bottom: 0; background: rgba(0,0,0,0.12); } .bar span { position: relative; }
    .sumbar { position: absolute; height: 10px; background: #2f2a4a; border-radius: 3px; } .sumbar.crit { background: #e0457b; } .sumcap { position: absolute; width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 9px solid #2f2a4a; } .sumcap.crit { border-top-color: #e0457b; }
    .rows .ms { position: absolute; width: 16px; height: 16px; background: #ffd166; border-radius: 4px; transform: rotate(45deg); } .rows .ms.deliver { background: #2f2a4a; }
    .rows .buf { position: absolute; height: 24px; border-radius: 999px; border: 2px solid #e0457b; background: repeating-linear-gradient(135deg, #ffe0ec 0 6px, #ffffff 6px 12px); display: flex; align-items: center; padding: 0 10px; font-size: 11px; color: #b8285a; font-weight: 500; white-space: nowrap; overflow: hidden; } .rows .buf .used { position: absolute; left: 0; top: 0; bottom: 0; background: rgba(224,69,123,0.35); } .rows .buf span { position: relative; }
    .rows .mres { position: absolute; height: 24px; border-radius: 999px; border: 2px dashed #d6d1ea; }
    .lbl { position: absolute; font-size: 10px; color: #8a83a8; white-space: nowrap; }
    .today { position: absolute; top: 0; bottom: 0; width: 2px; background: #6a4fd8; }
    .foot { height: 40px; display: flex; align-items: center; gap: 12px; padding: 0 8px; font-size: 12px; color: #6f6893; flex-shrink: 0; } .tag { background: #6a4fd8; color: #ffffff; padding: 2px 10px; border-radius: 999px; font-weight: 500; } .foot strong { color: #2f2a4a; }
    /* mobile */
    .phone { width: 390px; height: 844px; background: #f2f0fa; position: relative; overflow: hidden; display: flex; flex-direction: column; }
    .mhdr { height: 52px; margin: 12px 12px 0; background: #6a4fd8; border-radius: 16px; display: flex; align-items: center; gap: 10px; padding: 0 12px; color: #ffffff; flex-shrink: 0; } .mhdr .ib { width: 36px; height: 36px; border-radius: 999px; background: rgba(255,255,255,0.14); display: flex; align-items: center; justify-content: center; } .mhdr h2 { flex: 1; font-size: 16px; color: #ffffff; }
    .mbody { flex: 1; overflow: hidden; padding: 12px 12px 0; display: flex; flex-direction: column; gap: 12px; }
    .msec { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    .mopt { border-radius: 14px; background: #f7f5fc; padding: 14px; display: flex; flex-direction: column; gap: 8px; border: 2px solid transparent; position: relative; } .mopt.on { background: #ffffff; border-color: #6a4fd8; } .mopt .row { display: flex; align-items: center; gap: 8px; } .mopt .row h3 { flex: 1; } .mopt .radio { width: 22px; height: 22px; border-radius: 999px; border: 2px solid #d6d1ea; } .mopt.on .radio { border-color: #6a4fd8; background: #6a4fd8; display: flex; align-items: center; justify-content: center; color: #ffffff; } .mopt p { margin: 0; font-size: 13px; line-height: 1.5; }
    .msave { position: absolute; left: 12px; right: 12px; bottom: 16px; height: 48px; border-radius: 999px; background: #2f2a4a; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 500; font-size: 15px; box-shadow: 0 6px 16px rgba(47,42,74,0.18); }
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

const hbar = (tab) => `<div class="hbar"><div class="brand"><div class="brand-mark"></div><div class="brand-name">แผนงาน</div></div><div class="switch">ระบบจองห้องประชุม ${I.chev(16)}</div><div class="tabs"><span class="${tab === 'gantt' ? 'on' : ''}">${I.gantt(18)}Gantt</span><span>${I.cal(18)}ปฏิทิน</span><span>${I.res(18)}ทรัพยากร</span><span class="${tab === 'settings' ? 'on' : ''}">${I.gear(18)}ตั้งค่า</span></div><div class="spacer"></div><div class="av">ส</div></div>`;

// ---------- Settings desktop ----------
const bufferCards = (mobile = false) => `
  <div class="opt on"><div class="tick">${I.check(14)}</div><span class="rec">แนะนำ</span><h3>รวมเผื่อไว้ท้ายโครงการ</h3>
    <p>กรอกเวลาแต่ละงานแบบ "ถ้าราบรื่นจะเสร็จใน" โดยไม่ต้องเผื่อ แล้วระบบรวมเวลาเผื่อของทั้งโครงการไว้เป็นก้อนเดียวท้ายสุด</p>
    <div class="fit">เหมาะเมื่อ คุณตั้งใจกรอกเวลาแบบไม่เผื่อ และอยากเห็นชัดว่าเผื่อไว้กี่วัน ใช้ไปเท่าไร</div>
    <div class="slider"><span>สัดส่วนเผื่อ</span><div class="track"><div class="fill"></div><div class="knob"></div></div><b style="color:#2f2a4a">50%</b></div>
    <div class="ex">สายงานหลัก <b>17 วัน</b> → เผื่อ <b>9 วัน</b> → สัญญาส่ง <b>19 ต.ค. 2569</b></div>
    <span class="faint">Critical Chain (Goldratt)</span>
  </div>
  <div class="opt"><h3>บวกเพิ่มตามความเสี่ยง</h3>
    <p>กรอกเวลาแบบปกติ (เผื่อในตัวเล็กน้อยได้) แล้วบวกเพิ่มท้ายโครงการตามระดับความเสี่ยง</p>
    <div class="fit">เหมาะเมื่อ คุณกรอกเวลาแบบที่คุ้นเคย หรือรับแผนมาจากคนอื่นที่เผื่อไว้แล้ว</div>
    <div class="seg"><span>ต่ำ 10%</span><span class="on">กลาง 15%</span><span>สูง 25%</span></div>
    <div class="ex">สายงานหลัก <b>17 วัน</b> × 15% → เผื่อ <b>3 วัน</b> → สัญญาส่ง <b>9 ต.ค. 2569</b></div>
    <span class="faint">PMBOK Contingency reserve</span>
  </div>
  <div class="opt"><h3>ประเมิน 3 ค่า</h3>
    <p>กรอก 3 ค่าต่องาน เร็วสุด / ปกติ / ช้าสุด ระบบคำนวณเวลาที่น่าจะเป็น และเผื่อตามความมั่นใจที่เลือก</p>
    <div class="fit">เหมาะเมื่อ งานมีความไม่แน่นอนต่างกันมาก และคุณยอมกรอกข้อมูลเพิ่ม</div>
    <div class="seg"><span class="on">มั่นใจ 84%</span><span>98%</span></div>
    <div class="ex">ต้องกรอกค่าเพิ่มอีก <b>7 งาน</b> จึงจะคำนวณได้</div>
    <span class="faint">PERT three-point estimate</span>
  </div>`;

const settingsDesktop = wrap(`<div style="width:1280px;height:1400px;padding:16px;display:flex;flex-direction:column;gap:16px;background:#f2f0fa;overflow:hidden">
  ${hbar('settings')}
  <div class="page"><div class="sheet">
    <div style="display:flex;align-items:center;gap:12px"><div><div class="crumb">ระบบจองห้องประชุม</div><h1>ตั้งค่าโปรเจกต์</h1></div><div class="spacer"></div><span class="chip soft">บันทึกอัตโนมัติ</span></div>

    <div class="card sec">
      <div class="sec-head"><h2>วันทำงาน</h2><p>วันที่ระบบนับเป็นวันทำงาน วันอื่นจะถูกข้าม</p></div>
      <div class="daybtns"><div class="db on">จ</div><div class="db on">อ</div><div class="db on">พ</div><div class="db on">พฤ</div><div class="db on">ศ</div><div class="db">ส</div><div class="db">อา</div></div>
      <div class="hol"><span class="muted" style="font-size:12px">วันหยุดพิเศษ</span><span class="chip soft">13 ต.ค. วันนวมินทรมหาราช</span><span class="chip soft">23 ต.ค. วันปิยมหาราช</span><span class="chip primary">${I.plus(14)} เพิ่มวันหยุด</span></div>
    </div>

    <div class="card sec">
      <div class="sec-head"><h2>สำรองเวลา</h2><p>เลือกวิธีคิดเวลาเผื่อของโครงการ ตัวอย่างคำนวณจากแผนปัจจุบันของคุณ</p></div>
      <div class="opts">${bufferCards()}</div>
      <div class="mr"><span>เวลาเผื่อสำหรับเรื่องที่คาดไม่ถึง (management reserve) จะไม่แสดงในแผนที่แชร์</span><div class="num"><span>5</span><span class="muted">%</span></div><span>= 1 วัน</span></div>
    </div>

    <div class="card sec">
      <div class="sec-head"><h2>กติกาการคำนวณ</h2><p>ทุกข้อมีค่าเริ่มต้นตามหลักที่ใช้กันทั่วไป เปลี่ยนได้ทุกเมื่อ</p></div>
      <div class="rule"><div class="rl"><h3>งานไหนนับเป็น critical ${I.info(14)}</h3><span class="faint">Critical Path Method</span></div><div class="rr"><div class="seg"><span class="on">เลื่อนไม่ได้เลย</span><span>รวมงานที่เลื่อนได้ไม่เกิน N วัน</span></div><p>งานที่เลื่อนแล้วโครงการเลื่อนตามทันที</p><div class="ex">ตอนนี้มี critical <b>4 งาน</b></div></div></div>
      <div class="rule"><div class="rl"><h3>เวลารอ (lag) นับอย่างไร ${I.info(14)}</h3><span class="faint">MS Project / Primavera default</span></div><div class="rr"><div class="seg"><span class="on">ข้ามวันหยุด</span><span>นับทุกวันรวมวันหยุด</span></div><p>รอ 2 วันจากศุกร์ จะได้วันอังคาร เหมาะกับงานที่คนต้องทำ</p></div></div>
      <div class="rule"><div class="rl"><h3>เมื่อลากงานไปวางวันอื่น ${I.info(14)}</h3><span class="faint">Auto vs manual scheduling</span></div><div class="rr"><div class="seg"><span class="on">ระบบขยับให้ตามความสัมพันธ์</span><span>อยู่ที่วางไว้ ระบบแค่เตือน</span></div><p>ลากแล้วถ้าขัดกับงานก่อนหน้า ระบบจะดันไปวันที่เป็นไปได้ที่ใกล้ที่สุด</p></div></div>
      <div class="rule off"><div class="rl"><h3>วิธีตรวจว่างานล่าช้า ${I.info(14)}</h3><span class="faint">Earned Schedule</span></div><div class="rr"><div class="seg"><span class="on">เทียบเวลาที่ผ่านไป</span><span>เทียบกับ baseline</span><span>เลยกำหนดเท่านั้น</span></div><p>ตัวเลือก "เทียบกับ baseline" ใช้ได้เมื่อบันทึก baseline แล้ว</p></div></div>
    </div>

    <div class="card sec"><div class="danger"><div><h2>โซนอันตราย</h2><p class="crumb" style="margin:2px 0 0">ทำสำเนาก่อนลบถ้าไม่แน่ใจ</p></div><div class="spacer"></div><div class="btn sm">ทำสำเนา</div><div class="btn sm" style="background:#ffe0ec;color:#b8285a">ลบโปรเจกต์</div></div></div>
  </div></div>
</div>`);

// ---------- Settings mobile ----------
const settingsMobile = wrap(`<div class="phone">
  <div class="mhdr"><div class="ib">${I.back(20)}</div><h2>ตั้งค่า · สำรองเวลา</h2></div>
  <div class="mbody">
    <div class="card msec">
      <div><h2>เลือกวิธีคิดเวลาเผื่อ</h2><p class="crumb" style="margin:2px 0 0">ตัวอย่างคำนวณจากแผนของคุณ</p></div>
      <div class="mopt on"><div class="row"><div class="radio">${I.check(13)}</div><h3>รวมเผื่อไว้ท้ายโครงการ</h3><span class="rec" style="display:inline-flex;height:22px;padding:0 8px;border-radius:999px;background:#ffd166;font-size:11px;font-weight:500;align-items:center">แนะนำ</span></div>
        <p>กรอกเวลาแต่ละงานแบบ "ถ้าราบรื่นจะเสร็จใน" ไม่ต้องเผื่อ แล้วระบบรวมเวลาเผื่อไว้ก้อนเดียวท้ายสุด</p>
        <div class="slider"><span>สัดส่วน</span><div class="track"><div class="fill"></div><div class="knob"></div></div><b style="color:#2f2a4a">50%</b></div>
        <div class="ex" style="background:#e6e1fb;color:#4e37b0">สายงานหลัก <b>17 วัน</b> → เผื่อ <b>9 วัน</b><br>สัญญาส่ง <b>19 ต.ค. 2569</b></div>
        <span class="faint">Critical Chain (Goldratt)</span>
      </div>
      <div class="mopt"><div class="row"><div class="radio"></div><h3>บวกเพิ่มตามความเสี่ยง</h3></div><p class="muted" style="font-size:12px">กรอกเวลาแบบปกติ แล้วบวก 10 / 15 / 25% ท้ายโครงการ · เผื่อ 3 วัน</p></div>
      <div class="mopt"><div class="row"><div class="radio"></div><h3>ประเมิน 3 ค่า</h3></div><p class="muted" style="font-size:12px">กรอกเร็วสุด / ปกติ / ช้าสุด ต่องาน · ต้องกรอกเพิ่ม 7 งาน</p></div>
    </div>
    <div class="card msec">
      <div class="mr" style="flex-wrap:wrap"><span style="flex:1;min-width:180px">เผื่อสำหรับเรื่องที่คาดไม่ถึง ไม่แสดงในแผนที่แชร์</span><div class="num"><span>5</span><span class="muted">%</span></div></div>
    </div>
  </div>
  <div class="msave">เสร็จสิ้น</div>
</div>`);

// ---------- Gantt with WBS + buffer ----------
function ganttBuffer() {
  const DAY = 24, ROW = 40, W = 42 * DAY;
  const weeks = [['14 – 20 ก.ย.', [14, 15, 16, 17, 18, 19, 20]], ['21 – 27 ก.ย.', [21, 22, 23, 24, 25, 26, 27]], ['28 ก.ย. – 4 ต.ค.', [28, 29, 30, 1, 2, 3, 4]], ['5 – 11 ต.ค.', [5, 6, 7, 8, 9, 10, 11]], ['12 – 18 ต.ค.', [12, 13, 14, 15, 16, 17, 18]], ['19 – 25 ต.ค.', [19, 20, 21, 22, 23, 24, 25]]];
  let days = '';
  for (const [n, ds] of weeks) days += `<div class="wk" style="width:${7 * DAY}px"><div class="wk-name">${n}</div><div class="wk-days">${ds.map((d, i) => `<div class="d${i >= 5 ? ' we' : ''}" style="width:${DAY}px">${d}</div>`).join('')}</div></div>`;
  const rows = [
    { wbs: '1', name: 'รวบรวมความต้องการ', s: 0, e: 2, crit: true, pg: 100 },
    { wbs: '2', name: 'ออกแบบ', sum: true, s: 3, e: 9, crit: true, pg: 33 },
    { wbs: '2.1', name: 'ออกแบบระบบ', s: 3, e: 9, crit: true, pg: 40, l1: true },
    { wbs: '2.2', name: 'ออกแบบ UI', s: 3, e: 8, crit: false, pg: 25, l1: true },
    { wbs: '3', name: 'พัฒนา', sum: true, s: 9, e: 17, crit: true, pg: 0 },
    { wbs: '3.1', name: 'พัฒนา Backend', s: 10, e: 17, crit: true, pg: 0, l1: true },
    { wbs: '3.2', name: 'พัฒนา Frontend', s: 9, e: 15, crit: false, pg: 0, l1: true },
    { wbs: '4', name: 'ทดสอบระบบ', s: 18, e: 22, crit: true, pg: 0 },
    { wbs: '5', name: 'เสร็จตามแผน', ms: true, s: 22 },
    { wbs: '', name: 'สำรองเวลาโครงการ', buf: true },
  ];
  let tbl = `<div class="tbl"><div class="tr head"><span class="wbs">WBS</span><span class="nm">ชื่องาน</span></div>`;
  for (const r of rows) tbl += `<div class="tr${r.sum ? ' sum' : ''}${r.l1 ? ' l1' : ''}"><span class="wbs">${r.wbs}</span><span class="nm">${r.sum ? `<span class="car">${I.caretDown(14)}</span>` : ''}<span class="dot${r.crit ? ' crit' : ''}${r.ms ? ' ms' : ''}${r.buf ? ' buf' : ''}"></span>${r.name}</span></div>`;
  tbl += '</div>';
  let body = '';
  for (let i = 0; i < 6; i++) body += `<div class="we-col" style="left:${(i * 7 + 5) * DAY}px;width:${2 * DAY}px"></div>`;
  for (let i = 0; i < rows.length; i++) body += '<div class="grid-row"></div>';
  body += `<div class="today" style="left:${DAY}px"></div>`;
  // arrows
  const ri = (wbs) => rows.findIndex((r) => r.wbs === wbs);
  const links = [['1', '2.1', true], ['1', '2.2', false], ['2.1', '3.1', true], ['2.2', '3.2', false], ['3.1', '4', true], ['3.2', '4', false], ['4', '5', true]];
  let paths = '';
  for (const [a, b, crit] of links) {
    const A = rows[ri(a)], B = rows[ri(b)];
    const x1 = (A.e + 1) * DAY, y1 = ri(a) * ROW + ROW / 2, x2 = B.s * DAY, y2 = ri(b) * ROW + ROW / 2;
    let dd;
    if (B.ms) dd = `M${x1} ${y1} V${y2 - 12}`;
    else dd = x2 > x1 + 12 ? `M${x1} ${y1} h${(x2 - x1) / 2} V${y2} H${x2}` : `M${x1} ${y1} h6 V${y2 - ROW / 2} H${x2 - 5} V${y2} h5`;
    paths += `<path d="${dd}" stroke="${crit ? '#e0457b' : '#b7b1d6'}" marker-end="url(#${crit ? 'ar' : 'ag'})"></path>`;
  }
  body += `<svg style="position:absolute;left:0;top:0" width="${W}" height="${rows.length * ROW}" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><defs><marker id="ar" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6z" fill="#e0457b" stroke="none"></path></marker><marker id="ag" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6z" fill="#b7b1d6" stroke="none"></path></marker></defs>${paths}</svg>`;
  rows.forEach((r, i) => {
    const y = i * ROW;
    if (r.sum) {
      const l = r.s * DAY, w = (r.e - r.s + 1) * DAY;
      body += `<div class="sumbar${r.crit ? ' crit' : ''}" style="left:${l}px;top:${y + 12}px;width:${w}px"></div><div class="sumcap${r.crit ? ' crit' : ''}" style="left:${l}px;top:${y + 20}px"></div><div class="sumcap${r.crit ? ' crit' : ''}" style="left:${l + w - 12}px;top:${y + 20}px"></div>`;
    } else if (r.ms) {
      const cx = (r.s + 1) * DAY;
      body += `<div class="ms" style="left:${cx - 8}px;top:${y + 12}px"></div><div class="lbl" style="left:${cx + 14}px;top:${y + 13}px">6 ต.ค.</div>`;
    } else if (r.buf) {
      const l = 23 * DAY, w = 13 * DAY, end = l + w;
      body += `<div class="buf" style="left:${l}px;top:${y + 8}px;width:${w - 14}px"><div class="used" style="width:22%"></div><span>เผื่อ 9 วัน · ใช้ไป 2 วัน</span></div>`;
      body += `<div class="ms deliver" style="left:${end - 8}px;top:${y + 12}px"></div>`;
      body += `<div class="mres" style="left:${end + 12}px;top:${y + 8}px;width:${DAY}px"></div>`;
      body += `<div class="lbl" style="left:${end + DAY + 18}px;top:${y + 13}px;color:#2f2a4a;font-weight:500">สัญญาส่ง 19 ต.ค. · เผื่อฉุกเฉิน 1 วัน</div>`;
    } else {
      const l = r.s * DAY, w = (r.e - r.s + 1) * DAY;
      body += `<div class="bar${r.crit ? ' crit' : ''}" style="left:${l}px;top:${y + 8}px;width:${w}px"><div class="pg" style="width:${r.pg}%"></div>${w >= 120 ? `<span>${r.name}</span>` : ''}</div>`;
    }
  });
  return `<div class="gantt">${tbl}<div class="tl"><div class="days">${days}</div><div class="rows" style="height:${rows.length * ROW}px">${body}</div></div></div>`;
}

const ganttDesktop = wrap(`<div style="width:1280px;height:720px;padding:16px;display:flex;flex-direction:column;gap:12px;background:#f2f0fa;overflow:hidden">
  ${hbar('gantt')}
  <div class="tool"><div class="btn sm">${I.list(16)}<span>รายการงาน</span></div><div class="seg white"><span>วัน</span><span class="on">สัปดาห์</span><span>เดือน</span></div><div class="spacer"></div><span class="chip">Critical 4 งาน</span><span class="chip green">เผื่อยังปลอดภัย · ใช้ 22% / งาน 35%</span><span class="chip soft">เสร็จตามแผน 6 ต.ค. · สัญญาส่ง 19 ต.ค.</span><div class="btn primary" style="height:36px">${I.plus(14)}<span>เพิ่มงาน</span></div></div>
  ${ganttBuffer()}
  <div class="foot"><span class="tag">Gantt</span><strong>กลุ่มงาน (WBS) + แถบสำรองเวลา</strong><span>แถบสีเข้มมีขีดปลาย = กลุ่มงาน · แถบลายทแยงขอบชมพู = เวลาเผื่อ ส่วนทึบคือที่ใช้ไปแล้ว · เพชรดำ = วันสัญญาส่ง</span></div>
</div>`);

writeFileSync('SettingsDesktop.dc.html', settingsDesktop);
writeFileSync('SettingsMobile.dc.html', settingsMobile);
writeFileSync('GanttBuffer.dc.html', ganttDesktop);
console.log('built SettingsDesktop, SettingsMobile, GanttBuffer');
