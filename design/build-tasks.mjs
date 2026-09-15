import { writeFileSync } from 'node:fs';

// Artboards for two task-panel features: checklist (งานย่อย) and "create task chain".
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
  <style>${css}</style>
</helmet>
<div style="width:${size.w}px;height:${size.h}px;overflow:hidden;background:#f2f0fa">${body}</div>
</x-dc>
</body>
</html>`;

// ---------------------------------------------------------------- 1. checklist in the task panel (desktop)
const checklistItems = (m) => `
  <div class="ck done"><span class="grip">${I.grip(14)}</span><span class="box on">${I.check(14)}</span><span class="txt">เขียน spec หน้าจอ putaway</span><span class="del">${I.trash(14)}</span></div>
  <div class="ck done"><span class="grip">${I.grip(14)}</span><span class="box on">${I.check(14)}</span><span class="txt">ตกลง API กับ Backend</span><span class="del">${I.trash(14)}</span></div>
  <div class="ck edit"><span class="grip">${I.grip(14)}</span><span class="box"></span><span class="txt">ทำหน้าจอสแกน barcode</span><span class="del">${I.trash(14)}</span></div>
  <div class="ck"><span class="grip">${I.grip(14)}</span><span class="box"></span><span class="txt">เชื่อม API บันทึกตำแหน่ง</span><span class="del">${I.trash(14)}</span></div>
  <div class="ck"><span class="grip">${I.grip(14)}</span><span class="box"></span><span class="txt">ทดสอบกับคลังจริง 1 รอบ</span><span class="del">${I.trash(14)}</span></div>
  <div class="ck add">${I.plus(16)}<span>เพิ่มงานย่อย · พิมพ์แล้ว Enter</span></div>`;

const checklistSection = `
  <div class="sec">
    <div class="sec-head"><h3>งานย่อย</h3><span class="chip primary" style="height:26px">เสร็จ 2 / 5</span></div>
    <div class="pbar"><div style="width:40%"></div></div>
    ${checklistItems()}
    <div class="tog on"><span class="tr"></span><span>คิด % ความคืบหน้าจากงานย่อย</span></div>
    <div class="note">${I.info(16)}<span>ติ๊กงานย่อยแล้ว % ของงานจะเป็น <b>2 ÷ 5 = 40%</b> อัตโนมัติ ปิดสวิตช์ถ้าอยากกรอก % เอง</span></div>
  </div>`;

const panelDesktop = `<div style="padding:20px;display:flex;gap:20px;align-items:flex-start">
<div class="panel" style="min-height:780px">
  <div class="panel-head"><div><div class="crumb">งาน #3</div><h2>ทำ putaway</h2></div><div class="iconbtn">${I.x(16)}</div></div>
  <div><span class="chip">อยู่บน Critical path</span></div>
  <div class="frow">
    <div class="field"><div class="label">ระยะเวลา</div><div class="input">5 <span class="sfx">วัน</span></div><div class="hint">ไม่ต้องเผื่อ</div></div>
    <div class="field"><div class="label">ความคืบหน้า <span class="r">จากงานย่อย</span></div><div class="input ro">40 <span class="sfx">%</span></div></div>
  </div>
  <div class="frow">
    <div class="field"><div class="label">เริ่ม</div><div class="input ro">17 ก.ย. 2569</div></div>
    <div class="field"><div class="label">สิ้นสุด</div><div class="input ro">23 ก.ย. 2569</div></div>
  </div>
  ${checklistSection}
  <div class="sec">
    <div class="sec-head"><h3>งานต่อเนื่อง</h3></div>
    <div class="btn" style="justify-content:center">${I.chain(16)}<span>สร้างงานต่อจากงานนี้…</span></div>
    <div class="hint">สร้างชุดงาน เช่น ออกแบบ UI → พัฒนา → ทดสอบ → deploy แล้วผูกลำดับให้อัตโนมัติ</div>
  </div>
  <div class="sec">
    <div class="sec-head"><h3>งานก่อนหน้า</h3></div>
    <div class="dep"><span class="dep-name">รวบรวมความต้องการ</span><span class="pill">FS</span><span class="pill soft">+0 วัน</span></div>
  </div>
  <div style="flex:1"></div>
  <div class="frow"><div class="btn primary" style="flex:1">เสร็จสิ้น</div><div class="btn danger">${I.trash(16)}<span>ลบ</span></div></div>
</div>
<div style="width:300px;display:flex;flex-direction:column;gap:12px;padding-top:8px">
  <div class="note">${I.info(16)}<span><b>งานย่อย (checklist)</b> อยู่ในแผงงานเดิม ไม่ใช่งานใน Gantt ไม่มีวันเริ่ม/สิ้นสุด และไม่กระทบ critical path</span></div>
  <div class="note">${I.info(16)}<span><b>แก้ข้อความ</b> คลิกที่ข้อความแล้วพิมพ์ทับ (แถวที่ 3 กำลังแก้) · <b>ลบ</b> ปุ่มถังขยะ · <b>เรียงลำดับ</b> ลากที่จุด 6 จุด</span></div>
  <div class="note">${I.info(16)}<span>เมื่อสวิตช์ "คิด % จากงานย่อย" เปิด ช่อง % จะอ่านอย่างเดียว และ Gantt ใช้ค่านี้รวมความคืบหน้ากลุ่มตามปกติ</span></div>
  <div class="note warn">${I.info(16)}<span>ถ้าลบงานย่อยจนหมด % จะคงค่าสุดท้ายไว้ และกลับมาแก้เองได้</span></div>
</div>
</div>`;

// ---------------------------------------------------------------- 2. chain dialog (desktop)
const step = (on, name, dur, extra = '') => `<div class="step${on ? '' : ' off'}"><span class="grip">${I.grip(14)}</span><span class="box${on ? ' on' : ''}">${on ? I.check(14) : ''}</span><div class="nm"><span class="pre">ทำ putaway –</span><span>${name}</span></div><div class="dur">${dur}<span>วัน</span></div><span class="del">${I.trash(14)}</span></div>${extra}`;

const chainDialog = `<div class="backdrop">
<div class="dlg">
  <div class="dlg-head"><div><h2>สร้างงานต่อจาก "ทำ putaway"</h2><p>เลือกขั้นตอนที่ต้องมี ระบบจะสร้างงานตามลำดับและผูกความสัมพันธ์ FS ให้ · กรอกระยะเวลาแบบไม่ต้องเผื่อ</p></div><div class="iconbtn">${I.x(16)}</div></div>
  <div class="steps">
    ${step(true, 'ออกแบบ UI', 3)}
    ${step(true, 'พัฒนา Frontend', 5)}
    ${step(true, 'พัฒนา Backend', 5, `<div class="par"><span class="tog on"><span class="tr"></span></span><span>Frontend กับ Backend ทำคู่ขนาน (เริ่มพร้อมกัน)</span></div>`)}
    ${step(true, 'ทดสอบ', 3)}
    ${step(false, 'UAT กับผู้ใช้', 2)}
    ${step(true, 'Deploy', 1)}
    <div class="addstep">${I.plus(16)}<span>เพิ่มขั้นตอนเอง</span></div>
  </div>
  <div class="opts">
    <div class="opt"><span class="box on">${I.check(14)}</span><div class="t">ตั้งชื่อขึ้นต้นด้วยชื่องานนี้ <small>"ทำ putaway – ออกแบบ UI" แก้ชื่อทีละงานได้ในแถวด้านบน</small></div></div>
    <div class="opt"><span class="box on">${I.check(14)}</span><div class="t">รวมงานทั้งหมดเป็นกลุ่ม "ทำ putaway" <small>งานนี้กลายเป็นกลุ่ม (summary) และงานใหม่เป็นงานลูก ถ้าไม่ติ๊ก งานใหม่จะต่อท้ายงานนี้ในระดับเดียวกัน</small></div></div>
    <div class="opt"><span class="box">${''}</span><div class="t">คัดลอกผู้รับผิดชอบของงานนี้ไปทุกงานใหม่ <small>สมชาย 100%</small></div></div>
  </div>
  <div class="preview">
    <div class="ttl">${I.chain(14)} ลำดับที่จะได้</div>
    <div class="flow">
      <span class="nd src">ทำ putaway <small>5 วัน</small></span><span class="ar">${I.arrow(14)}</span>
      <span class="nd">ออกแบบ UI <small>3</small></span><span class="ar">${I.arrow(14)}</span>
      <span class="nd stack"><span>พัฒนา Frontend <small>5</small></span><span>พัฒนา Backend <small>5</small></span></span><span class="ar">${I.arrow(14)}</span>
      <span class="nd">ทดสอบ <small>3</small></span><span class="ar">${I.arrow(14)}</span>
      <span class="nd">Deploy <small>1</small></span>
    </div>
    <div class="sum">รวม <b>5 งานใหม่ · 17 วันทำงาน</b> · จะเสร็จ <b>16 ต.ค. 2569</b> · งานทั้งชุดอยู่บน critical path</div>
  </div>
  <div class="dlg-foot"><span class="faint">จำรายการขั้นตอนนี้ไว้ใช้ครั้งหน้า (ต่อโปรเจกต์)</span><span class="spacer"></span><div class="btn ghost">ยกเลิก</div><div class="btn primary">${I.plus(16)}<span>สร้าง 5 งาน</span></div></div>
</div>
</div>`;

// ---------------------------------------------------------------- 3. mobile checklist sheet
const mobileChecklist = `<div class="phone">
  <div class="mhdr"><div class="ib" style="background:#ffd166;border-radius:10px;width:30px;height:30px"></div><div class="sw">ระบบ WMS ${I.chev(14)}</div><div class="ib">···</div></div>
  <div class="dim"></div>
  <div class="sheet" style="height:86%">
    <div class="handle"></div>
    <div class="body">
      <div class="panel-head"><div><div class="crumb">งาน #3</div><h2>ทำ putaway</h2></div><div class="iconbtn">${I.x(16)}</div></div>
      <div><span class="chip">อยู่บน Critical path</span></div>
      <div class="frow">
        <div class="field"><div class="label">ระยะเวลา</div><div class="input">5 <span class="sfx">วัน</span></div></div>
        <div class="field"><div class="label">ความคืบหน้า <span class="r">จากงานย่อย</span></div><div class="input ro">40 <span class="sfx">%</span></div></div>
      </div>
      ${checklistSection.replace('พิมพ์แล้ว Enter', 'แตะเพื่อพิมพ์')}
      <div class="sec">
        <div class="btn" style="justify-content:center">${I.chain(16)}<span>สร้างงานต่อจากงานนี้…</span></div>
      </div>
    </div>
    <div class="foot"><div class="btn primary" style="flex:1">เสร็จสิ้น</div><div class="btn danger">${I.trash(16)}<span>ลบ</span></div></div>
  </div>
</div>`;

// ---------------------------------------------------------------- 4. mobile chain sheet
const mstep = (on, name, dur) => `<div class="step${on ? '' : ' off'}"><span class="box${on ? ' on' : ''}">${on ? I.check(14) : ''}</span><div class="nm"><span>${name}</span></div><div class="dur">${dur}<span>วัน</span></div></div>`;
const mobileChain = `<div class="phone m">
  <div class="mhdr"><div class="ib" style="background:#ffd166;border-radius:10px;width:30px;height:30px"></div><div class="sw">ระบบ WMS ${I.chev(14)}</div><div class="ib">···</div></div>
  <div class="dim"></div>
  <div class="sheet" style="height:92%">
    <div class="handle"></div>
    <div class="body">
      <div class="dlg-head"><div><h2>สร้างงานต่อจาก "ทำ putaway"</h2><p>เลือกขั้นตอน ระบบผูกลำดับ FS ให้ · ชื่องานขึ้นต้นด้วย "ทำ putaway –"</p></div><div class="iconbtn">${I.x(16)}</div></div>
      <div class="steps">
        ${mstep(true, 'ออกแบบ UI', 3)}
        ${mstep(true, 'พัฒนา Frontend', 5)}
        ${mstep(true, 'พัฒนา Backend', 5)}
        <div class="par"><span class="tog on"><span class="tr"></span></span><span>FE กับ BE ทำคู่ขนาน</span></div>
        ${mstep(true, 'ทดสอบ', 3)}
        ${mstep(false, 'UAT กับผู้ใช้', 2)}
        ${mstep(true, 'Deploy', 1)}
        <div class="addstep">${I.plus(16)}<span>เพิ่มขั้นตอนเอง</span></div>
      </div>
      <div class="opts">
        <div class="opt"><span class="box on">${I.check(14)}</span><div class="t">รวมเป็นกลุ่ม "ทำ putaway"</div></div>
        <div class="opt"><span class="box"></span><div class="t">คัดลอกผู้รับผิดชอบ (สมชาย 100%)</div></div>
      </div>
      <div class="preview">
        <div class="ttl">${I.chain(14)} ลำดับที่จะได้</div>
        <div class="flow">
          <span class="nd src">ทำ putaway</span><span class="ar">${I.arrow(14)}</span><span class="nd">ออกแบบ UI</span><span class="ar">${I.arrow(14)}</span><span class="nd stack"><span>Frontend</span><span>Backend</span></span><span class="ar">${I.arrow(14)}</span><span class="nd">ทดสอบ</span><span class="ar">${I.arrow(14)}</span><span class="nd">Deploy</span>
        </div>
        <div class="sum"><b>5 งานใหม่ · 17 วัน</b> · เสร็จ <b>16 ต.ค. 2569</b></div>
      </div>
    </div>
    <div class="foot"><div class="btn ghost" style="flex:1">ยกเลิก</div><div class="btn primary" style="flex:2">${I.plus(16)}<span>สร้าง 5 งาน</span></div></div>
  </div>
</div>`;

writeFileSync('TaskChecklist.dc.html', wrap(panelDesktop, { w: 720, h: 840 }));
writeFileSync('ChainDialog.dc.html', wrap(chainDialog, { w: 760, h: 860 }));
writeFileSync('MobileChecklist.dc.html', wrap(mobileChecklist, { w: 390, h: 844 }));
writeFileSync('MobileChain.dc.html', wrap(mobileChain, { w: 390, h: 844 }));
console.log('built TaskChecklist, ChainDialog, MobileChecklist, MobileChain');
