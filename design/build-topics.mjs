import { writeFileSync } from 'node:fs';

// Artboards for "เพิ่มหัวข้อ" (topic = group + tasks + sub-items) incl. paste-from-Excel.
// Values follow docs/design-system.md / tokens.css exactly (Kanit, #6a4fd8 primary, 18px cards, pill controls).

const icon = (p, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const I = {
  x: (s) => icon('<path d="M18 6L6 18"></path><path d="M6 6l12 12"></path>', s),
  check: (s) => icon('<path d="M5 12l5 5L20 7"></path>', s),
  plus: (s) => icon('<path d="M12 5v14"></path><path d="M5 12h14"></path>', s),
  trash: (s) => icon('<path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 14H6L5 6"></path>', s),
  grip: (s) => icon('<circle cx="9" cy="6" r="1"></circle><circle cx="15" cy="6" r="1"></circle><circle cx="9" cy="12" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="9" cy="18" r="1"></circle><circle cx="15" cy="18" r="1"></circle>', s),
  link: (s) => icon('<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"></path><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"></path>', s),
  chain: (s) => icon('<rect x="3" y="4" width="6" height="6" rx="2"></rect><rect x="15" y="14" width="6" height="6" rx="2"></rect><path d="M9 7h4a3 3 0 0 1 3 3v4"></path>', s),
  arrow: (s) => icon('<path d="M5 12h14"></path><path d="M13 6l6 6-6 6"></path>', s),
  info: (s) => icon('<circle cx="12" cy="12" r="9"></circle><path d="M12 11v5"></path><path d="M12 8h.01"></path>', s),
  chev: (s) => icon('<path d="M6 9l6 6 6-6"></path>', s),
  pencil: (s) => icon('<path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path>', s),
};

const css = `
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Kanit", "Segoe UI", Tahoma, sans-serif; color: #2f2a4a; background: #f2f0fa; font-size: 13px; }
  h2 { margin: 0; font-size: 18px; font-weight: 600; line-height: 1.25; } h3 { margin: 0; font-size: 14px; font-weight: 600; }
  .crumb { font-size: 12px; color: #716a91; } .muted { color: #6f6893; } .faint { color: #716a91; font-size: 11px; }
  .panel { width: 360px; background: #ffffff; border-radius: 18px; box-shadow: 0 2px 8px rgba(47,42,74,0.06); padding: 20px; display: flex; flex-direction: column; gap: 14px; }
  .panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
  .iconbtn { width: 36px; height: 36px; border-radius: 999px; background: #f2f0fa; color: #6f6893; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .chip { height: 30px; padding: 0 12px; border-radius: 999px; font-size: 12px; font-weight: 500; background: #ffe0ec; color: #b8285a; display: inline-flex; align-items: center; gap: 6px; } .chip.primary { background: #e6e1fb; color: #4e37b0; } .chip.green { background: #dff3ee; color: #136b5c; } .chip.soft { background: #f2f0fa; color: #6f6893; }
  .frow { display: flex; gap: 10px; } .frow .field { flex: 1; }
  .field { display: flex; flex-direction: column; gap: 6px; } .label { font-size: 12px; color: #716a91; font-weight: 500; display: flex; align-items: center; gap: 6px; } .label .r { margin-left: auto; font-weight: 400; }
  .input { height: 40px; border-radius: 12px; background: #f2f0fa; padding: 0 12px; display: flex; align-items: center; justify-content: space-between; } .input.ro { color: #6f6893; } .input .sfx { color: #716a91; font-size: 12px; }
  .hint { font-size: 11px; color: #716a91; }
  .btn { height: 40px; padding: 0 16px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; font-weight: 500; background: #ffffff; color: #2f2a4a; box-shadow: 0 1px 2px rgba(47,42,74,0.08); } .btn.primary { background: #2f2a4a; color: #ffffff; box-shadow: 0 6px 16px rgba(47,42,74,0.18); } .btn.ghost { background: #f2f0fa; box-shadow: none; } .btn.sm { height: 36px; font-size: 12px; padding: 0 12px; } .btn.danger { color: #b8285a; background: #f2f0fa; box-shadow: none; }
  .sec { display: flex; flex-direction: column; gap: 8px; }
  .sec-head { display: flex; align-items: center; gap: 8px; } .sec-head h3 { flex: 1; }
  /* checklist */
  .ck { display: flex; align-items: center; gap: 8px; min-height: 40px; border-radius: 12px; background: #f7f5fc; padding: 0 6px 0 8px; }
  .ck .grip { color: #c9c4e0; display: flex; }
  .box { width: 22px; height: 22px; border-radius: 7px; border: 2px solid #c9c4e0; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: #ffffff; } .box.on { background: #6a4fd8; border-color: #6a4fd8; }
  .ck .txt { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .ck.done .txt { color: #716a91; text-decoration: line-through; }
  .ck .del { width: 32px; height: 32px; border-radius: 999px; display: flex; align-items: center; justify-content: center; color: #b7b1d6; }
  .ck.edit { background: #ffffff; outline: 2px solid #6a4fd8; } .ck.edit .txt { border-right: 2px solid #6a4fd8; padding-right: 1px; }
  .ck.add { background: transparent; border: 2px dashed #d6d1ea; color: #716a91; justify-content: center; }
  .pbar { height: 8px; border-radius: 999px; background: #f2f0fa; overflow: hidden; } .pbar div { height: 8px; border-radius: 999px; background: #6a4fd8; }
  .prow { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #6f6893; } .prow b { color: #2f2a4a; font-weight: 600; }
  .tog { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: #2f2a4a; } .tog .tr { width: 36px; height: 20px; border-radius: 999px; background: #d6d1ea; position: relative; } .tog .tr::after { content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 999px; background: #ffffff; } .tog.on .tr { background: #6a4fd8; } .tog.on .tr::after { left: 18px; }
  .note { display: flex; gap: 8px; align-items: flex-start; padding: 10px 12px; border-radius: 12px; background: #e6e1fb; color: #4e37b0; font-size: 12px; line-height: 1.45; } .note svg { flex-shrink: 0; margin-top: 1px; }
  .note.warn { background: #fff3d6; color: #6b4a00; }
  .dep { display: flex; align-items: center; gap: 8px; height: 40px; border-radius: 12px; background: #f2f0fa; padding: 0 12px; } .dep-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pill { height: 24px; padding: 0 8px; border-radius: 999px; background: #6a4fd8; color: #ffffff; font-size: 11px; font-weight: 500; display: inline-flex; align-items: center; } .pill.soft { background: #e6e1fb; color: #4e37b0; }
  /* dialog */
  .backdrop { width: 100%; height: 100%; background: rgba(47,42,74,0.35); display: flex; align-items: center; justify-content: center; padding: 24px; }
  .dlg { width: 600px; background: #ffffff; border-radius: 18px; box-shadow: 0 16px 48px rgba(47,42,74,0.24); padding: 24px; display: flex; flex-direction: column; gap: 16px; }
  .dlg-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; } .dlg-head p { margin: 4px 0 0; color: #6f6893; font-size: 12px; line-height: 1.5; }
  .steps { display: flex; flex-direction: column; gap: 6px; }
  .step { display: grid; grid-template-columns: 22px 22px minmax(0, 1fr) 96px 32px; align-items: center; gap: 10px; height: 46px; border-radius: 12px; background: #f7f5fc; padding: 0 8px 0 10px; }
  .step.off { opacity: 0.55; } .step .grip { color: #c9c4e0; display: flex; }
  .step .nm { height: 34px; border-radius: 10px; background: #ffffff; padding: 0 10px; display: flex; align-items: center; gap: 6px; } .step .nm .pre { color: #716a91; } .step.off .nm { background: transparent; }
  .step .dur { height: 34px; border-radius: 10px; background: #ffffff; padding: 0 10px; display: flex; align-items: center; justify-content: space-between; font-variant-numeric: tabular-nums; } .step .dur span { color: #716a91; font-size: 11px; }
  .step .del { width: 32px; height: 32px; border-radius: 999px; display: flex; align-items: center; justify-content: center; color: #b7b1d6; }
  .par { margin: -2px 0 0 54px; display: flex; align-items: center; gap: 8px; font-size: 12px; color: #6f6893; height: 28px; } .par .tog { transform: scale(0.9); transform-origin: left center; }
  .addstep { height: 40px; border-radius: 12px; border: 2px dashed #d6d1ea; color: #716a91; display: flex; align-items: center; justify-content: center; gap: 6px; }
  .opts { display: flex; flex-direction: column; gap: 10px; padding: 12px 14px; border-radius: 14px; background: #f7f5fc; }
  .opt { display: flex; align-items: center; gap: 10px; } .opt .t { flex: 1; } .opt .t small { display: block; color: #716a91; font-size: 11px; }
  .preview { border-radius: 14px; background: #e6e1fb; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
  .preview .ttl { font-size: 12px; color: #4e37b0; font-weight: 500; display: flex; gap: 6px; align-items: center; }
  .flow { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
  .nd { height: 28px; padding: 0 10px; border-radius: 999px; background: #ffffff; color: #2f2a4a; font-size: 12px; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; } .nd.src { background: #2f2a4a; color: #ffffff; } .nd small { color: #716a91; font-size: 11px; } .nd.src small { color: #d9d2f7; }
  .nd.stack { flex-direction: column; height: auto; padding: 4px 10px; gap: 2px; align-items: flex-start; border-radius: 12px; } .nd.stack span { display: block; }
  .flow .ar { color: #6a4fd8; display: flex; }
  .sum { font-size: 12px; color: #4e37b0; } .sum b { font-weight: 600; }
  .dlg-foot { display: flex; align-items: center; gap: 10px; } .dlg-foot .spacer { flex: 1; }
  /* mobile */
  .phone { width: 390px; height: 844px; background: #f2f0fa; position: relative; overflow: hidden; display: flex; flex-direction: column; }
  .mhdr { height: 52px; margin: 12px 12px 0; background: #6a4fd8; border-radius: 16px; display: flex; align-items: center; gap: 10px; padding: 0 12px; color: #ffffff; flex-shrink: 0; } .mhdr .sw { flex: 1; height: 36px; border-radius: 999px; background: rgba(255,255,255,0.14); display: flex; align-items: center; justify-content: center; gap: 6px; font-weight: 500; font-size: 13px; } .mhdr .ib { width: 36px; height: 36px; border-radius: 999px; background: rgba(255,255,255,0.14); display: flex; align-items: center; justify-content: center; }
  .dim { position: absolute; inset: 0; background: rgba(47,42,74,0.35); }
  .sheet { position: absolute; left: 0; right: 0; bottom: 0; max-height: 86%; background: #ffffff; border-radius: 24px 24px 0 0; box-shadow: 0 -8px 32px rgba(47,42,74,0.16); padding: 10px 16px 0; display: flex; flex-direction: column; gap: 12px; }
  .handle { width: 40px; height: 4px; border-radius: 999px; background: #d6d1ea; margin: 0 auto 2px; }
  .sheet .body { display: flex; flex-direction: column; gap: 12px; overflow: hidden; }
  .sheet .foot { position: sticky; bottom: 0; background: #ffffff; padding: 12px 0 calc(12px + 20px); display: flex; gap: 10px; box-shadow: 0 -8px 16px rgba(255,255,255,0.9); }
  .bnav { position: absolute; left: 0; right: 0; bottom: 0; height: 84px; background: #ffffff; border-radius: 24px 24px 0 0; box-shadow: 0 -4px 24px rgba(47,42,74,0.08); }
  .m .step { grid-template-columns: 22px minmax(0, 1fr) 76px; height: 44px; padding: 0 8px 0 10px; } .m .step .nm { padding: 0 8px; } .m .par { margin-left: 34px; }
  .m .dlg-head p { font-size: 12px; }
`;

const css2 = css + `
  .tabs { display: inline-flex; background: #f2f0fa; border-radius: 999px; padding: 4px; height: 36px; align-self: flex-start; } .tabs span { display: flex; align-items: center; padding: 0 14px; border-radius: 999px; color: #6f6893; font-size: 12px; } .tabs span.on { background: #6a4fd8; color: #ffffff; font-weight: 500; }
  .cols { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 16px; }
  .rowh { display: grid; grid-template-columns: minmax(0,1fr) 84px 32px; gap: 8px; font-size: 11px; color: #716a91; padding: 0 8px; }
  .trow { display: grid; grid-template-columns: minmax(0,1fr) 84px 32px; gap: 8px; align-items: center; }
  .trow .in { height: 36px; border-radius: 10px; background: #f2f0fa; padding: 0 10px; display: flex; align-items: center; justify-content: space-between; } .trow .in.sub { margin-left: 22px; font-size: 12px; color: #4e37b0; background: #eeeaff; }
  .trow .in span.u { color: #716a91; font-size: 11px; }
  .trow .del { width: 32px; height: 32px; border-radius: 999px; display: flex; align-items: center; justify-content: center; color: #b7b1d6; }
  .paste { border-radius: 12px; background: #f7f5fc; border: 2px dashed #d6d1ea; padding: 12px; font-family: Consolas, monospace; font-size: 12px; line-height: 1.55; color: #2f2a4a; white-space: pre; overflow: hidden; min-height: 200px; }
  .paste b { color: #6a4fd8; font-weight: 400; }
  .tree { border-radius: 14px; background: #f7f5fc; padding: 12px; display: flex; flex-direction: column; gap: 4px; font-size: 12px; }
  .tree .g { display: flex; align-items: center; gap: 6px; font-weight: 600; margin-top: 6px; } .tree .g:first-child { margin-top: 0; } .tree .g .sq { width: 10px; height: 10px; background: #2f2a4a; border-radius: 2px; }
  .tree .t { display: flex; align-items: center; gap: 6px; padding-left: 16px; } .tree .t .dot { width: 8px; height: 8px; border-radius: 999px; background: #8fd3c7; } .tree .t small { color: #716a91; margin-left: auto; }
  .tree .c { padding-left: 40px; color: #716a91; font-size: 11px; display: flex; gap: 6px; align-items: center; } .tree .c .bx { width: 10px; height: 10px; border-radius: 3px; border: 1.5px solid #c9c4e0; }
  .stat { font-size: 12px; color: #4e37b0; padding: 10px 12px; border-radius: 12px; background: #e6e1fb; line-height: 1.5; } .stat b { font-weight: 600; }
  .optrow { display: flex; align-items: center; gap: 10px; font-size: 12px; } .optrow .seg { display: inline-flex; background: #ffffff; border-radius: 999px; padding: 3px; height: 32px; } .optrow .seg span { display: flex; align-items: center; padding: 0 10px; border-radius: 999px; color: #6f6893; font-size: 11px; } .optrow .seg span.on { background: #6a4fd8; color: #ffffff; }
  .optrow .num { height: 32px; width: 72px; border-radius: 10px; background: #ffffff; display: flex; align-items: center; justify-content: space-between; padding: 0 10px; font-size: 12px; } .optrow .num span { color: #716a91; font-size: 11px; }
  .split { display: inline-flex; } .split .btn { border-radius: 999px 0 0 999px; } .split .btn + .btn { border-radius: 0 999px 999px 0; padding: 0 10px; margin-left: 1px; }
  .menu { position: absolute; top: 46px; right: 0; width: 240px; background: #ffffff; border-radius: 12px; box-shadow: 0 8px 24px rgba(47,42,74,0.16); padding: 6px; display: flex; flex-direction: column; gap: 2px; }
  .menu span { display: flex; align-items: center; gap: 8px; height: 38px; padding: 0 12px; border-radius: 8px; font-size: 13px; } .menu span.on { background: #f2f0fa; }
  .m .cols { grid-template-columns: 1fr; }
`;
const wrap = (body, size) => `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;500;600&amp;display=swap">
  <style>${css2}</style>
</helmet>
<div style="width:${size.w}px;height:${size.h}px;overflow:hidden;background:#f2f0fa">${body}</div>
</x-dc>
</body>
</html>`;


const I2 = {
  ...I,
  folder: (s) => icon('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>', s),
  paste: (s) => icon('<rect x="8" y="2" width="8" height="4" rx="1"></rect><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>', s),
};

// ---------------- 1. entry point: split button on the Gantt toolbar
const entry = `<div style="padding:20px;display:flex;flex-direction:column;gap:14px">
  <div class="note">${I.info(16)}<span><b>จุดเข้า</b> ปุ่ม "เพิ่มงาน" กลายเป็นปุ่มแยก: คลิกซ้าย = เพิ่มงานเดี่ยวเหมือนเดิม คลิกลูกศร = เมนู 3 ทาง</span></div>
  <div style="position:relative;align-self:flex-end;height:180px;width:320px">
    <div class="split" style="position:absolute;right:0;top:0"><div class="btn primary">${I.plus(16)}<span>เพิ่มงาน</span></div><div class="btn primary">${I.chev(16)}</div></div>
    <div class="menu">
      <span>${I.plus(16)} เพิ่มงาน <small class="faint" style="margin-left:auto">N</small></span>
      <span class="on">${I2.folder(16)} เพิ่มหัวข้อ (กลุ่ม + งานข้างใน)</span>
      <span>${I2.paste(16)} วางจาก Excel / รายการ</span>
    </div>
  </div>
  <div class="note">${I.info(16)}<span>ใน "เพิ่มงาน" เดิม ช่อง "อยู่ในกลุ่ม" เพิ่มตัวเลือกท้ายสุด <b>"+ สร้างกลุ่มใหม่…"</b> พิมพ์ชื่อได้เลยโดยไม่ต้องออกจากกล่อง</span></div>
  <div class="note">${I.info(16)}<span>ในแผงงานของ<b>กลุ่ม</b> มีปุ่ม "เพิ่มงานในหัวข้อนี้…" เปิดกล่องเดียวกันโดยเลือกกลุ่มไว้ให้แล้ว</span></div>
</div>`;

// ---------------- 2. topic dialog – manual tab
const trow = (name, d, sub=false) => `<div class="trow"><div class="in${sub?' sub':''}"><span>${name}</span></div><div class="in"><span>${d}</span><span class="u">วัน</span></div><span class="del">${I.trash(14)}</span></div>`;
const topicDialog = `<div class="backdrop"><div class="dlg" style="width:720px">
  <div class="dlg-head"><div><h2>เพิ่มหัวข้อ</h2><p>หัวข้อ = กลุ่มงาน 1 กลุ่ม ระยะเวลาและ % ของหัวข้อคำนวณจากงานข้างในเสมอ · กรอกวันแบบไม่ต้องเผื่อ</p></div><div class="iconbtn">${I.x(16)}</div></div>
  <div class="tabs"><span class="on">พิมพ์เอง</span><span>วางจาก Excel / รายการ</span></div>
  <div class="cols">
    <div style="display:flex;flex-direction:column;gap:10px">
      <div class="field"><div class="label">ชื่อหัวข้อ</div><div class="input">Picking list</div></div>
      <div class="field"><div class="label">งานในหัวข้อ <span class="r">Enter = แถวใหม่ · Tab = งานย่อย (checklist)</span></div>
        <div class="rowh"><span>ชื่องาน</span><span>ระยะเวลา</span><span></span></div>
        ${trow('Picking list', 3)}
        ${trow('Plant Route (Mobile)', 5)}
        ${trow('Confirm', 2)}
        ${trow('Import LMS', 3)}
        ${trow('Import Due list', 2)}
        <div class="addstep">${I.plus(16)}<span>เพิ่มงาน</span></div>
      </div>
      <div class="opts">
        <div class="optrow"><span style="width:120px">ลำดับงานข้างใน</span><div class="seg"><span class="on">ต่อกันตามลำดับ (FS)</span><span>ทำพร้อมกัน</span></div></div>
        <div class="optrow"><span style="width:120px">วางหัวข้อไว้</span><div class="seg"><span class="on">ท้ายสุด</span><span>ต่อจากงานที่เลือก</span></div></div>
        <div class="optrow"><span style="width:120px">วันเริ่มต้นถ้าไม่กรอก</span><div class="num"><span style="color:#2f2a4a">3</span><span>วัน</span></div></div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <div class="label">ตัวอย่างที่จะได้</div>
      <div class="tree">
        <div class="g"><span class="sq"></span>3 Picking list <small style="margin-left:auto;color:#716a91;font-weight:400">15 วัน</small></div>
        <div class="t"><span class="dot"></span>3.1 Picking list <small>3</small></div>
        <div class="t"><span class="dot"></span>3.2 Plant Route (Mobile) <small>5</small></div>
        <div class="t"><span class="dot"></span>3.3 Confirm <small>2</small></div>
        <div class="t"><span class="dot"></span>3.4 Import LMS <small>3</small></div>
        <div class="t"><span class="dot"></span>3.5 Import Due list <small>2</small></div>
      </div>
      <div class="stat">หัวข้อยาว <b>15 วันทำงาน</b> (ต่อกัน) · เริ่ม 16 ก.ย. เสร็จ <b>6 ต.ค. 2569</b><br>ถ้าเลือก "ทำพร้อมกัน" จะยาว 5 วัน</div>
      <div class="note">${I.info(14)}<span>เมื่อแก้งานข้างในทีหลัง แถบหัวข้อจะยืด/หดเอง แก้ระยะเวลาของหัวข้อตรง ๆ ไม่ได้</span></div>
    </div>
  </div>
  <div class="dlg-foot"><span class="faint">สร้างแล้วยังแก้ทุกอย่างได้ในแผงงาน</span><span class="spacer"></span><div class="btn ghost">ยกเลิก</div><div class="btn primary">${I.plus(16)}<span>สร้างหัวข้อ + 5 งาน</span></div></div>
</div></div>`;

// ---------------- 3. topic dialog – paste tab (many topics at once)
const pasteDialog = `<div class="backdrop"><div class="dlg" style="width:720px">
  <div class="dlg-head"><div><h2>เพิ่มหัวข้อ</h2><p>วางจาก Excel ได้เลย: คอลัมน์ <b>หัวข้อ</b> และ <b>งาน</b> (คอลัมน์ No ระบบข้ามให้) บรรทัดที่ขึ้นต้นด้วย "-" กลายเป็นงานย่อยของงานบรรทัดบน</p></div><div class="iconbtn">${I.x(16)}</div></div>
  <div class="tabs"><span>พิมพ์เอง</span><span class="on">วางจาก Excel / รายการ</span></div>
  <div class="cols">
    <div style="display:flex;flex-direction:column;gap:10px">
      <div class="paste">3	Picking list	Picking list
	Picking list	Plant Route (Mobile)
	Picking list	Confirm
	Picking list	Import LMS
	Picking list	Import Due list
4	Master for Standalone (Juno)	Integration Module ERP/Other legacy
	Master for Standalone (Juno)	Master Data (Cost center, Storage)
		<b>- Create</b>
		<b>- Edit</b>
		<b>- Upload Manual (Validate)</b>
		<b>- Display</b>
		<b>- Export Excel</b>
5	Interface Automated WH	Create Task
	Interface Automated WH	Update Task
	Interface Automated WH	Delete Task</div>
      <div class="hint">รองรับทั้งคั่นด้วย Tab (จาก Excel) และรูปแบบข้อความ: บรรทัดหัวข้อ แล้วบรรทัดงานย่อหน้าด้วยเว้นวรรค/Tab</div>
      <div class="opts">
        <div class="optrow"><span style="width:120px">ลำดับงานข้างใน</span><div class="seg"><span class="on">ต่อกันตามลำดับ (FS)</span><span>ทำพร้อมกัน</span></div></div>
        <div class="optrow"><span style="width:120px">ระหว่างหัวข้อ</span><div class="seg"><span class="on">หัวข้อถัดไปรอหัวข้อก่อน</span><span>อิสระต่อกัน</span></div></div>
        <div class="optrow"><span style="width:120px">วันต่อ 1 งาน</span><div class="num"><span style="color:#2f2a4a">3</span><span>วัน</span></div><span class="faint">แก้ทีละงานได้หลังสร้าง</span></div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <div class="label">อ่านได้ 3 หัวข้อ · 10 งาน · 5 งานย่อย</div>
      <div class="tree">
        <div class="g"><span class="sq"></span>Picking list <small style="margin-left:auto;color:#716a91;font-weight:400">5 งาน</small></div>
        <div class="t"><span class="dot"></span>Picking list <small>3</small></div>
        <div class="t"><span class="dot"></span>Plant Route (Mobile) <small>3</small></div>
        <div class="t"><span class="dot"></span>Confirm <small>3</small></div>
        <div class="t"><span class="dot"></span>Import LMS <small>3</small></div>
        <div class="t"><span class="dot"></span>Import Due list <small>3</small></div>
        <div class="g"><span class="sq"></span>Master for Standalone (Juno) <small style="margin-left:auto;color:#716a91;font-weight:400">2 งาน</small></div>
        <div class="t"><span class="dot"></span>Integration Module ERP/Other legacy <small>3</small></div>
        <div class="t"><span class="dot"></span>Master Data (Cost center, Storage) <small>3</small></div>
        <div class="c"><span class="bx"></span>Create</div><div class="c"><span class="bx"></span>Edit</div><div class="c"><span class="bx"></span>Upload Manual (Validate)</div><div class="c"><span class="bx"></span>Display</div><div class="c"><span class="bx"></span>Export Excel</div>
        <div class="g"><span class="sq"></span>Interface Automated WH <small style="margin-left:auto;color:#716a91;font-weight:400">3 งาน</small></div>
        <div class="t"><span class="dot"></span>Create Task <small>3</small></div>
        <div class="t"><span class="dot"></span>Update Task <small>3</small></div>
        <div class="t"><span class="dot"></span>Delete Task <small>3</small></div>
      </div>
      <div class="stat">รวม <b>30 วันทำงาน</b> เสร็จ <b>27 ต.ค. 2569</b> · หัวข้อไหนชื่อซ้ำกับกลุ่มเดิม จะเพิ่มงานเข้ากลุ่มเดิมแทน</div>
    </div>
  </div>
  <div class="dlg-foot"><span class="spacer"></span><div class="btn ghost">ยกเลิก</div><div class="btn primary">${I.plus(16)}<span>สร้าง 3 หัวข้อ · 10 งาน</span></div></div>
</div></div>`;

// ---------------- 4. mobile
const mobileTopic = `<div class="phone m">
  <div class="mhdr"><div class="ib" style="background:#ffd166;border-radius:10px;width:30px;height:30px"></div><div class="sw">ระบบ WMS ${I.chev(14)}</div><div class="ib">···</div></div>
  <div class="dim"></div>
  <div class="sheet" style="height:92%">
    <div class="handle"></div>
    <div class="body">
      <div class="dlg-head"><div><h2>เพิ่มหัวข้อ</h2><p>กลุ่มงาน 1 กลุ่ม + งานข้างใน ระยะเวลาของหัวข้อคิดจากงานข้างใน</p></div><div class="iconbtn">${I.x(16)}</div></div>
      <div class="tabs" style="align-self:stretch"><span class="on" style="flex:1;justify-content:center">พิมพ์เอง</span><span style="flex:1;justify-content:center">วางรายการ</span></div>
      <div class="field"><div class="label">ชื่อหัวข้อ</div><div class="input">Picking list</div></div>
      <div class="field"><div class="label">งานในหัวข้อ</div>
        ${trow('Picking list', 3)}
        ${trow('Plant Route (Mobile)', 5)}
        ${trow('Confirm', 2)}
        ${trow('Import LMS', 3)}
        ${trow('Import Due list', 2)}
        <div class="addstep">${I.plus(16)}<span>เพิ่มงาน</span></div>
      </div>
      <div class="opts">
        <div class="optrow"><span style="width:96px">ลำดับ</span><div class="seg"><span class="on">ต่อกัน (FS)</span><span>พร้อมกัน</span></div></div>
        <div class="optrow"><span style="width:96px">วางไว้</span><div class="seg"><span class="on">ท้ายสุด</span><span>ต่อจากที่เลือก</span></div></div>
      </div>
      <div class="stat">หัวข้อยาว <b>15 วัน</b> · เสร็จ <b>6 ต.ค. 2569</b></div>
    </div>
    <div class="foot"><div class="btn ghost" style="flex:1">ยกเลิก</div><div class="btn primary" style="flex:2">${I.plus(16)}<span>สร้างหัวข้อ + 5 งาน</span></div></div>
  </div>
</div>`;

writeFileSync('TopicEntry.dc.html', wrap(entry, { w: 560, h: 420 }));
writeFileSync('TopicDialog.dc.html', wrap(topicDialog, { w: 880, h: 760 }));
writeFileSync('TopicPaste.dc.html', wrap(pasteDialog, { w: 880, h: 900 }));
writeFileSync('MobileTopic.dc.html', wrap(mobileTopic, { w: 390, h: 844 }));
console.log('built TopicEntry, TopicDialog, TopicPaste, MobileTopic');
