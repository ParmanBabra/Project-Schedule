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
  .selbar { position: absolute; left: 50%; transform: translateX(-50%); bottom: 24px; display: flex; align-items: center; gap: 8px; height: 52px; padding: 0 8px 0 16px; border-radius: 999px; background: #2f2a4a; color: #ffffff; box-shadow: 0 10px 30px rgba(47,42,74,0.3); font-size: 13px; }
  .selbar .b { height: 36px; padding: 0 12px; border-radius: 999px; background: rgba(255,255,255,0.12); display: inline-flex; align-items: center; gap: 6px; } .selbar .b.pri { background: #6a4fd8; }
  .selbar .x { width: 36px; height: 36px; border-radius: 999px; display: flex; align-items: center; justify-content: center; }
  .tbl2 { width: 380px; background: #ffffff; border-radius: 18px; box-shadow: 0 2px 8px rgba(47,42,74,0.06); overflow: hidden; }
  .r { display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 12px; border-bottom: 1px solid #f1eff8; font-size: 13px; } .r.h { height: 40px; font-size: 12px; color: #716a91; }
  .r .cb { width: 20px; height: 20px; border-radius: 6px; border: 2px solid #c9c4e0; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: #ffffff; } .r .cb.on { background: #6a4fd8; border-color: #6a4fd8; }
  .r.sel { background: #eeeaff; } .r .wbs { width: 28px; color: #b7b1d6; font-size: 11px; } .r .nm { flex: 1; display: flex; align-items: center; gap: 6px; } .r.l1 .nm { padding-left: 18px; } .r.sum .nm { font-weight: 600; }
  .dot2 { width: 9px; height: 9px; border-radius: 999px; background: #8fd3c7; } .dot2.crit { background: #e0457b; } .sq2 { width: 10px; height: 10px; border-radius: 2px; background: #2f2a4a; }
  .ddl { border-radius: 12px; background: #ffffff; box-shadow: 0 8px 24px rgba(47,42,74,0.16); padding: 6px; display: flex; flex-direction: column; gap: 2px; width: 100%; }
  .ddl span { display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 10px; border-radius: 8px; font-size: 13px; } .ddl span.on { background: #f2f0fa; } .ddl span.new { color: #4e37b0; border-top: 1px solid #f1eff8; margin-top: 4px; padding-top: 4px; height: 40px; }

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


const I3 = { ...I, folder: (s) => icon('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>', s), move: (s) => icon('<path d="M5 12h14"></path><path d="M13 6l6 6-6 6"></path>', s) };

// ---------------- A. select existing tasks -> group them
const rows = [
  ['1','Stock visualization and Editor (Map)',false,false,false],
  ['2','Report Stock Location',false,false,false],
  ['3','Dashboard (confirm job / Delay)',false,false,false],
  ['4','Picking list',true,true,false],
  ['5','Plant Route (Mobile)',true,false,false],
  ['6','Confirm',true,false,false],
  ['7','Import LMS',true,false,true],
  ['8','Import Due list',true,false,false],
  ['9','Create Task',false,false,false],
];
const selectBoard = `<div style="padding:20px;display:flex;gap:20px;align-items:flex-start;position:relative;height:100%">
  <div class="tbl2">
    <div class="r h"><span class="cb"></span><span class="wbs">WBS</span><span class="nm">ชื่องาน</span><span class="faint">เลือกแล้ว 5</span></div>
    ${rows.map(([n,name,sel,first,crit]) => `<div class="r${sel?' sel':''}"><span class="cb${sel?' on':''}">${sel?I.check(12):''}</span><span class="wbs">${n}</span><span class="nm"><span class="dot2${crit?' crit':''}"></span>${name}</span></div>`).join('')}
  </div>
  <div style="display:flex;flex-direction:column;gap:12px;flex:1">
    <div class="note">${I.info(16)}<span><b>โหมดเลือก</b> เปิดด้วยปุ่ม "เลือกหลายงาน" ในแถบเครื่องมือ หรือ Shift/Ctrl+คลิกที่ชื่องาน จะมีช่องติ๊กโผล่หน้าชื่อทุกแถว (มือถือ: กดค้างที่ชื่องาน)</span></div>
    <div class="note">${I.info(16)}<span><b>รวมเป็นหัวข้อ</b> เปิดกล่องเล็ก ๆ ถามแค่ชื่อหัวข้อ (เดาให้จากงานแรกที่เลือก: "Picking list") แล้วงานที่เลือกทั้งหมดย้ายเข้าไปเป็นลูก คงลำดับและความสัมพันธ์เดิมทั้งหมด</span></div>
    <div class="note">${I.info(16)}<span><b>ย้ายไปหัวข้อ…</b> เลือกกลุ่มที่มีอยู่ หรือ "+ สร้างหัวข้อใหม่" · <b>เอาออกจากหัวข้อ</b> ยกกลับขึ้นระดับบน</span></div>
    <div class="note warn">${I.info(16)}<span>งานที่เลือกต้องอยู่ระดับเดียวกัน (พี่น้องกัน) ถ้าเลือกข้ามกลุ่ม ปุ่ม "รวมเป็นหัวข้อ" จะจางและบอกเหตุผล</span></div>
  </div>
  <div class="selbar">เลือก 5 งาน<span class="b pri">${I3.folder(16)} รวมเป็นหัวข้อ</span><span class="b">${I3.move(16)} ย้ายไปหัวข้อ…</span><span class="b">เอาออกจากหัวข้อ</span><span class="b" style="color:#ffb3c9">${I.trash(16)} ลบ</span><span class="x">${I.x(16)}</span></div>
</div>`;

// ---------------- B. task panel: field "หัวข้อ" with create-new
const panelBoard = `<div style="padding:20px;display:flex;gap:20px;align-items:flex-start">
<div class="panel" style="min-height:560px">
  <div class="panel-head"><div><div class="crumb">งาน #5</div><h2>Plant Route (Mobile)</h2></div><div class="iconbtn">${I.x(16)}</div></div>
  <div class="frow">
    <div class="field"><div class="label">ระยะเวลา</div><div class="input">5 <span class="sfx">วัน</span></div></div>
    <div class="field"><div class="label">ความคืบหน้า</div><div class="input">0 <span class="sfx">%</span></div></div>
  </div>
  <div class="field"><div class="label">อยู่ในหัวข้อ</div><div class="input" style="outline:2px solid #6a4fd8;background:#ffffff"><span>ไม่มี (ระดับบนสุด)</span>${I.chev(16)}</div>
    <div class="ddl">
      <span class="on">ไม่มี (ระดับบนสุด)</span>
      <span>${I3.folder(14)} Visualization</span>
      <span>${I3.folder(14)} Task Management</span>
      <span>${I3.folder(14)} Picking list</span>
      <span class="new">${I.plus(14)} สร้างหัวข้อใหม่แล้วย้ายไป…</span>
    </div>
  </div>
  <div class="note">${I.info(14)}<span>ย้ายแล้วความสัมพันธ์และผู้รับผิดชอบเดิมอยู่ครบ วันของหัวข้อจะขยายตามงานนี้ทันที</span></div>
  <div style="flex:1"></div>
  <div class="frow"><div class="btn primary" style="flex:1">เสร็จสิ้น</div><div class="btn danger">${I.trash(16)}<span>ลบ</span></div></div>
</div>
<div style="width:300px;display:flex;flex-direction:column;gap:12px;padding-top:8px">
  <div class="note">${I.info(16)}<span>ทีละงาน: แผงงานมีช่อง <b>"อยู่ในหัวข้อ"</b> เปลี่ยนได้ทันที (แทน "ย่อหน้าเข้า/ออก" ที่ต้องเปิดรายการงาน)</span></div>
  <div class="note">${I.info(16)}<span>เลือก "สร้างหัวข้อใหม่แล้วย้ายไป…" จะขอชื่อ แล้วสร้างกลุ่ม ณ ตำแหน่งของงานนี้ และย้ายงานเข้าไปเป็นลูกตัวแรก</span></div>
  <div class="note">${I.info(16)}<span>หลายงานพร้อมกัน: ใช้โหมดเลือกใน Gantt (อีกภาพ)</span></div>
</div>
</div>`;

writeFileSync('TopicSelect.dc.html', wrap(selectBoard, { w: 900, h: 560 }));
writeFileSync('TopicPanel.dc.html', wrap(panelBoard, { w: 720, h: 620 }));
console.log('built TopicSelect, TopicPanel');
