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
  .hbar2 { height: 60px; background: #6a4fd8; border-radius: 18px; display: flex; align-items: center; gap: 16px; padding: 0 20px; color: #ffffff; }
  .hbar2 .tabs2 { display: flex; gap: 4px; margin-left: 12px; } .hbar2 .tabs2 span { display: flex; align-items: center; gap: 8px; height: 38px; padding: 0 16px; border-radius: 999px; color: #d9d2f7; font-size: 13px; } .hbar2 .tabs2 span.on { background: #ffffff; color: #4e37b0; font-weight: 500; }
  .sw { display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 14px; border-radius: 999px; background: rgba(255,255,255,0.14); font-weight: 500; font-size: 13px; }
  .brandm { width: 30px; height: 30px; border-radius: 10px; background: #ffd166; } .brandn { font-weight: 600; font-size: 17px; }
  .pagehead { display: flex; align-items: center; gap: 12px; } .pagehead h1 { margin: 0; font-size: 20px; font-weight: 600; }
  .grid3 { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 14px; }
  .ecard { background: #ffffff; border-radius: 18px; box-shadow: 0 2px 8px rgba(47,42,74,0.06); padding: 16px 16px 14px; display: flex; flex-direction: column; gap: 10px; position: relative; overflow: hidden; }
  .ecard::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 6px; background: var(--c); }
  .ecard .top { display: flex; align-items: flex-start; gap: 8px; } .ecard h3 { flex: 1; font-size: 15px; }
  .ecard .desc { font-size: 12px; color: #6f6893; line-height: 1.45; }
  .ecard .meta { display: flex; gap: 12px; font-size: 12px; color: #716a91; flex-wrap: wrap; } .ecard .meta b { color: #2f2a4a; font-weight: 600; }
  .ecard .pb { height: 8px; border-radius: 999px; background: #f2f0fa; overflow: hidden; } .ecard .pb div { height: 8px; border-radius: 999px; background: var(--c); }
  .ecard .foot2 { display: flex; align-items: center; gap: 8px; } .avs { display: flex; } .avs .av2 { width: 24px; height: 24px; border-radius: 999px; color: #fff; font-size: 11px; display: flex; align-items: center; justify-content: center; margin-left: -6px; border: 2px solid #fff; } .avs .av2:first-child { margin-left: 0; }
  .st { height: 24px; padding: 0 10px; border-radius: 999px; font-size: 11px; font-weight: 500; display: inline-flex; align-items: center; gap: 4px; } .st.todo { background: #f2f0fa; color: #6f6893; } .st.doing { background: #e6e1fb; color: #4e37b0; } .st.done { background: #dff3ee; color: #136b5c; } .st.late { background: #ffe0ec; color: #b8285a; }
  .ecard.new { border: 2px dashed #d6d1ea; box-shadow: none; background: transparent; align-items: center; justify-content: center; color: #716a91; min-height: 150px; } .ecard.new::before { display: none; }
  .filters { display: flex; gap: 8px; align-items: center; } .filters .chip { height: 32px; }
  /* gantt with epic colours */
  .gwrap { display: flex; background: #ffffff; border-radius: 18px; box-shadow: 0 2px 8px rgba(47,42,74,0.06); overflow: hidden; height: 470px; }
  .gl { width: 300px; border-right: 1px solid #ece9f6; flex-shrink: 0; } .gr { flex: 1; position: relative; overflow: hidden; }
  .grow { height: 40px; border-bottom: 1px solid #f1eff8; display: flex; align-items: center; gap: 8px; padding: 0 12px; font-size: 13px; } .grow.hd { height: 56px; font-size: 12px; color: #716a91; }
  .grow .wbs2 { width: 30px; color: #b7b1d6; font-size: 11px; } .grow.sum { font-weight: 600; } .grow.l1 { padding-left: 30px; }
  .epdot { width: 10px; height: 10px; border-radius: 3px; } .tdot { width: 9px; height: 9px; border-radius: 999px; }
  .glines { position: absolute; inset: 56px 0 0 0; background: repeating-linear-gradient(90deg, transparent 0 139px, #f1eff8 139px 140px); }
  .ghead { height: 56px; border-bottom: 1px solid #ece9f6; display: flex; } .ghead span { width: 140px; flex-shrink: 0; border-right: 1px solid #ece9f6; padding: 8px; font-size: 12px; color: #4e37b0; font-weight: 500; }
  .gbar { position: absolute; height: 24px; border-radius: 999px; display: flex; align-items: center; padding: 0 10px; font-size: 11px; font-weight: 500; color: #ffffff; white-space: nowrap; overflow: hidden; }
  .gbar.task { background: var(--c); } .gbar.task.light { color: #1f2a44; } .gbar .pgf { position: absolute; left: 0; top: 0; bottom: 0; background: rgba(0,0,0,0.14); } .gbar span { position: relative; }
  .esum { position: absolute; height: 12px; border-radius: 4px; background: var(--c); } .esum::before, .esum::after { content: ""; position: absolute; top: 10px; border-left: 7px solid transparent; border-right: 7px solid transparent; border-top: 9px solid var(--c); } .esum::before { left: -1px; } .esum::after { right: -1px; }
  .etag { position: absolute; font-size: 11px; color: #4e37b0; white-space: nowrap; }
  .epanel { width: 340px; background: #ffffff; border-left: 1px solid #ece9f6; display: flex; flex-direction: column; gap: 12px; padding: 18px; flex-shrink: 0; }
  .swatches { display: flex; gap: 8px; } .swatches span { width: 26px; height: 26px; border-radius: 999px; } .swatches span.on { outline: 2px solid #2f2a4a; outline-offset: 2px; }
  .kv { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 8px; } .kv div { border-radius: 12px; background: #f7f5fc; padding: 8px 10px; display: flex; flex-direction: column; } .kv span { font-size: 11px; color: #716a91; } .kv b { font-size: 16px; font-weight: 600; }
  .tl2 { display: flex; flex-direction: column; gap: 4px; } .tl2 .it { display: flex; align-items: center; gap: 8px; height: 34px; padding: 0 10px; border-radius: 10px; background: #f7f5fc; font-size: 12px; } .tl2 .it small { margin-left: auto; color: #716a91; } .tl2 .it .bx2 { width: 14px; height: 14px; border-radius: 4px; border: 2px solid #c9c4e0; } .tl2 .it .bx2.on { background: #8fd3c7; border-color: #8fd3c7; }
  .colorrow { display: flex; align-items: center; gap: 10px; }

  .m .grid3 { grid-template-columns: 1fr; }
  .secbox { border-radius: 14px; background: #f7f5fc; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
  .sechead { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: #4e37b0; } .sechead small { font-weight: 400; color: #716a91; }
  .swatch2 { display: flex; gap: 8px; align-items: center; height: 40px; } .swatch2 span { width: 28px; height: 28px; border-radius: 999px; display: flex; align-items: center; justify-content: center; color: #fff; } .swatch2 span.on { outline: 2px solid #2f2a4a; outline-offset: 2px; }
  .trow2 { display: grid; grid-template-columns: 22px minmax(0,1fr) 92px 32px; gap: 8px; align-items: center; } .trow2 .in { height: 38px; border-radius: 10px; background: #ffffff; padding: 0 10px; display: flex; align-items: center; justify-content: space-between; } .trow2 .in span.u { color: #716a91; font-size: 11px; } .trow2 .grip { color: #c9c4e0; display: flex; justify-content: center; } .trow2 .del { width: 32px; height: 32px; border-radius: 999px; display: flex; align-items: center; justify-content: center; color: #b7b1d6; }
  .rowh2 { display: grid; grid-template-columns: 22px minmax(0,1fr) 92px 32px; gap: 8px; font-size: 11px; color: #716a91; padding: 0 10px; }
  .sumline { display: flex; align-items: center; gap: 10px; font-size: 12px; color: #4e37b0; background: #e6e1fb; border-radius: 12px; padding: 10px 12px; } .sumline b { font-weight: 600; }
  .mpage { flex: 1; overflow: hidden; padding: 14px 12px 0; display: flex; flex-direction: column; gap: 12px; }
  .mtitle { display: flex; align-items: baseline; gap: 10px; } .mtitle h1 { margin: 0; font-size: 22px; font-weight: 600; } .mtitle small { color: #716a91; font-size: 12px; }
  .mfilters { display: flex; gap: 8px; } .mfilters .chip { height: 32px; }
  .mcard { background: #ffffff; border-radius: 18px; box-shadow: 0 2px 8px rgba(47,42,74,0.06); padding: 14px 16px 14px 20px; display: flex; flex-direction: column; gap: 8px; position: relative; overflow: hidden; }
  .mcard::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 6px; background: var(--c); }
  .mcard .top { display: flex; align-items: center; gap: 8px; } .mcard h3 { flex: 1; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mcard .pbrow { display: flex; align-items: center; gap: 10px; } .mcard .pb { flex: 1; height: 8px; border-radius: 999px; background: #f2f0fa; overflow: hidden; } .mcard .pb div { height: 8px; border-radius: 999px; background: var(--c); } .mcard .pct { font-size: 13px; font-weight: 600; width: 40px; text-align: right; }
  .mcard .meta { display: flex; align-items: center; gap: 10px; font-size: 12px; color: #716a91; } .mcard .meta b { color: #2f2a4a; font-weight: 600; } .mcard .meta .avs { margin-left: auto; }
  .bnav2 { position: absolute; left: 0; right: 0; bottom: 0; height: 84px; background: #ffffff; border-radius: 24px 24px 0 0; box-shadow: 0 -4px 24px rgba(47,42,74,0.08); display: flex; align-items: flex-start; justify-content: space-around; padding: 8px 8px 0; }
  .bnav2 .ni { width: 60px; display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 11px; color: #716a91; } .bnav2 .ni.on { color: #6a4fd8; font-weight: 500; } .bnav2 .ni svg { color: currentColor; }
  .bnav2 .fab2 { width: 56px; height: 56px; border-radius: 999px; background: #2f2a4a; color: #fff; display: flex; align-items: center; justify-content: center; margin-top: -30px; box-shadow: 0 6px 16px rgba(47,42,74,0.24); }
  .mfab { position: absolute; right: 16px; bottom: 100px; height: 40px; padding: 0 14px; border-radius: 999px; background: #6a4fd8; color: #fff; display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; box-shadow: 0 6px 16px rgba(106,79,216,0.35); }


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
const EP = [
  { n: 'Visualization', c: '#6a4fd8', d: 'แผนที่สต๊อก รายงานตำแหน่ง และ dashboard งาน', pg: 70, t: 3, done: 2, late: 0, s: 'doing', from: '14 ก.ย.', to: '3 ต.ค.', who: ['ส','ว'] },
  { n: 'Task Management', c: '#1f9e89', d: 'GR / Picking list / Stock transfer / Relocation และลำดับงาน', pg: 100, t: 2, done: 2, late: 0, s: 'done', from: '16 ก.ย.', to: '26 ก.ย.', who: ['ส'] },
  { n: 'Picking list', c: '#e0457b', d: 'Picking list, Plant route (mobile), confirm, import LMS / due list', pg: 35, t: 5, done: 1, late: 1, s: 'late', from: '29 ก.ย.', to: '20 ต.ค.', who: ['ด','ว'] },
  { n: 'Master for Standalone (Juno)', c: '#f28c28', d: 'Integration module และ master data (create / edit / upload / display / export)', pg: 0, t: 2, done: 0, late: 0, s: 'todo', from: '21 ต.ค.', to: '31 ต.ค.', who: [] },
  { n: 'Interface Automated WH', c: '#2e86de', d: 'สร้าง/แก้/ลบ task และซิงก์สถานะกับคลังอัตโนมัติ', pg: 0, t: 5, done: 0, late: 0, s: 'todo', from: '3 พ.ย.', to: '14 พ.ย.', who: ['ว'] },
];
const who = { ส: '#6a4fd8', ด: '#e0457b', ว: '#1f9e89' };
const stLabel = { todo: 'ยังไม่เริ่ม', doing: 'กำลังทำ', done: 'เสร็จแล้ว', late: 'ล่าช้า 1 งาน' };
const hbar = (tab) => `<div class="hbar2"><div class="brandm"></div><span class="brandn">แผนงาน</span><span class="sw">ระบบ WMS ${I.chev(14)}</span><div class="tabs2">${['Gantt','ปฏิทิน','Epics','ทรัพยากร','ตั้งค่า'].map(t=>`<span class="${t===tab?'on':''}">${t}</span>`).join('')}</div></div>`;

// ---------------- 1. Epics page
const card = (e) => `<div class="ecard" style="--c:${e.c}">
  <div class="top"><h3>${e.n}</h3><span class="st ${e.s}">${stLabel[e.s]}</span></div>
  <div class="desc">${e.d}</div>
  <div class="pb"><div style="width:${e.pg}%"></div></div>
  <div class="meta"><span><b>${e.pg}%</b></span><span>งาน <b>${e.done}/${e.t}</b></span><span>${e.from} – ${e.to}</span>${e.late?`<span style="color:#b8285a">ล่าช้า ${e.late}</span>`:''}</div>
  <div class="foot2"><div class="avs">${e.who.map(w=>`<span class="av2" style="background:${who[w]}">${w}</span>`).join('')}</div><span class="spacer"></span><span class="faint">ดูใน Gantt →</span></div>
</div>`;
const epicsPage = `<div style="padding:16px;display:flex;flex-direction:column;gap:14px;height:100%">
  ${hbar('Epics')}
  <div class="pagehead"><h1>Epics</h1><span class="chip soft">5 epics · 17 งาน</span><div class="filters" style="margin-left:auto"><span class="chip soft">ทั้งหมด</span><span class="chip primary">กำลังทำ 2</span><span class="chip">ล่าช้า 1</span></div><div class="btn primary">${I.plus(16)}<span>สร้าง Epic</span></div></div>
  <div class="grid3">${EP.map(card).join('')}<div class="ecard new">${I.plus(18)}&nbsp;สร้าง Epic ใหม่ · หรือวางจาก Excel</div></div>
  <div class="note" style="margin-top:auto">${I.info(16)}<span>Epic = กลุ่มงานที่มีสี คำอธิบาย และหน้าภาพรวมของตัวเอง วัน / % / สถานะ คำนวณจากงานข้างในเสมอ กดการ์ดแล้วไปที่ Gantt โดยกรองเฉพาะ Epic นั้น</span></div>
</div>`;

// ---------------- 2. Gantt with epic colours + epic panel
const rowsG = [
  ['1','Visualization',true,'#6a4fd8'],['1.1','Stock visualization and Editor (Map)',false,'#6a4fd8'],['1.2','Report Stock Location',false,'#6a4fd8'],['1.3','Dashboard (confirm job / Delay)',false,'#6a4fd8'],
  ['2','Picking list',true,'#e0457b'],['2.1','Picking list',false,'#e0457b'],['2.2','Plant Route (Mobile)',false,'#e0457b'],['2.3','Confirm',false,'#e0457b'],['2.4','Import LMS',false,'#e0457b'],['2.5','Import Due list',false,'#e0457b'],
];
const bars = [
  [0,0,3,true],[1,0,1.4,false,60],[2,1.4,1.2,false,20],[3,2.2,0.8,false,0],
  [4,3,4,true],[5,3,0.8,false,100],[6,3.8,1.2,false,40],[7,5,0.6,false,0],[8,5.6,0.9,false,0],[9,6.4,0.6,false,0],
];
const ganttEpic = `<div style="padding:16px;display:flex;flex-direction:column;gap:12px;height:100%">
  ${hbar('Gantt')}
  <div style="display:flex;align-items:center;gap:8px;height:44px"><div class="btn sm">${I.grip(16)}<span>รายการงาน</span></div><div class="tabs" style="height:40px;background:#ffffff"><span>วัน</span><span class="on">สัปดาห์</span><span>เดือน</span></div><span class="chip primary" style="height:36px">${I3.folder(14)} Epic: Picking list ${I.x(12)}</span><span class="chip soft" style="height:36px">ทุก Epic ▾</span><span class="spacer"></span><span class="chip">Critical 3 งาน</span><span class="chip green">เผื่อ 6 วัน</span><div class="split"><div class="btn primary sm">${I.plus(16)}<span>เพิ่มงาน</span></div><div class="btn primary sm">${I.chev(16)}</div></div></div>
  <div class="gwrap">
    <div class="gl">
      <div class="grow hd"><span class="wbs2">WBS</span><span>ชื่องาน</span></div>
      ${rowsG.map(([w,n,sum,c]) => `<div class="grow ${sum?'sum':'l1'}"><span class="wbs2">${w}</span>${sum?`<span class="epdot" style="background:${c}"></span>`:`<span class="tdot" style="background:${c};opacity:.55"></span>`}<span>${n}</span>${sum?`<span class="chip soft" style="height:22px;margin-left:auto;font-size:11px">Epic</span>`:''}</div>`).join('')}
    </div>
    <div class="gr">
      <div class="ghead">${['14 – 20 ก.ย.','21 – 27 ก.ย.','28 ก.ย. – 4 ต.ค.','5 – 11 ต.ค.','12 – 18 ต.ค.','19 – 25 ต.ค.','26 ต.ค. – 1 พ.ย.','2 – 8 พ.ย.'].map(w=>`<span>${w}</span>`).join('')}</div>
      <div class="glines"></div>
      ${bars.map(([r,s,len,sum,pg]) => { const c = rowsG[r][3]; const top = 56 + r*40 + (sum?14:8); const left = s*140+6, width = len*140-12; return sum ? `<div class="esum" style="left:${left}px;width:${width}px;top:${top}px;--c:${c}"></div>` : `<div class="gbar task" style="left:${left}px;width:${width}px;top:${top}px;--c:${c}"><div class="pgf" style="width:${pg}%"></div><span>${rowsG[r][1]}</span></div>`; }).join('')}
    </div>
    <div class="epanel">
      <div class="panel-head"><div><div class="crumb">Epic · 5 งาน</div><h2 style="display:flex;align-items:center;gap:8px"><span class="epdot" style="background:#e0457b;width:14px;height:14px"></span>Picking list</h2></div><div class="iconbtn">${I.x(16)}</div></div>
      <div class="colorrow"><span class="label" style="width:40px">สี</span><div class="swatches"><span style="background:#6a4fd8"></span><span class="on" style="background:#e0457b"></span><span style="background:#1f9e89"></span><span style="background:#f28c28"></span><span style="background:#2e86de"></span><span style="background:#a1519c"></span></div></div>
      <div class="field"><div class="label">เป้าหมาย / คำอธิบาย</div><div class="input" style="height:auto;padding:10px 12px;font-size:12px;line-height:1.45;align-items:flex-start">พนักงานหยิบสินค้าตาม picking list บนมือถือ ยืนยันแล้วส่งผลกลับ LMS</div></div>
      <div class="kv"><div><span>ความคืบหน้า</span><b>35%</b></div><div><span>เสร็จ</span><b>1 / 5</b></div><div><span>ล่าช้า</span><b style="color:#b8285a">1</b></div></div>
      <div class="frow"><div class="field"><div class="label">เริ่ม</div><div class="input ro">29 ก.ย. 2569</div></div><div class="field"><div class="label">สิ้นสุด</div><div class="input ro">20 ต.ค. 2569</div></div></div>
      <div class="hint">คำนวณจากงานข้างใน แก้ตรงนี้ไม่ได้</div>
      <div class="label">งานใน Epic <span class="r">ลากเรียงได้</span></div>
      <div class="tl2">
        <div class="it"><span class="bx2 on"></span>Picking list<small>3 วัน · 100%</small></div>
        <div class="it"><span class="bx2"></span>Plant Route (Mobile)<small style="color:#b8285a">ล่าช้า · 40%</small></div>
        <div class="it"><span class="bx2"></span>Confirm<small>2 วัน</small></div>
        <div class="it"><span class="bx2"></span>Import LMS<small>3 วัน</small></div>
        <div class="it"><span class="bx2"></span>Import Due list<small>2 วัน</small></div>
      </div>
      <div class="frow"><div class="btn sm" style="flex:1;justify-content:center">${I.plus(14)}<span>เพิ่มงานใน Epic</span></div><div class="btn sm">${I3.move(14)}<span>ย้ายงานเข้า…</span></div></div>
      <div style="flex:1"></div>
      <div class="frow"><div class="btn primary" style="flex:1">เสร็จสิ้น</div><div class="btn danger">${I.trash(16)}<span>ลบ Epic</span></div></div>
    </div>
  </div>
</div>`;

// ---------------- 3. create epic dialog
const rowE = (n, d) => `<div class="trow2"><span class="grip">${I.grip(14)}</span><div class="in"><span>${n}</span></div><div class="in"><span>${d}</span><span class="u">วัน</span></div><span class="del">${I.trash(14)}</span></div>`;
const createEpic = `<div class="backdrop"><div class="dlg" style="width:680px;gap:14px">
  <div class="dlg-head"><div><h2>สร้าง Epic</h2><p>Epic คือเรื่องใหญ่หนึ่งเรื่องที่มีสีและเป้าหมายของตัวเอง งานข้างในเป็นตัวกำหนดวันและ % ของ Epic</p></div><div class="iconbtn">${I.x(16)}</div></div>

  <div class="secbox">
    <div class="sechead">1 · ข้อมูล Epic</div>
    <div class="frow">
      <div class="field" style="flex:1"><div class="label">ชื่อ Epic</div><div class="input" style="background:#ffffff">Picking list</div></div>
      <div class="field" style="flex:0 0 auto"><div class="label">สี</div><div class="swatch2"><span style="background:#6a4fd8"></span><span class="on" style="background:#e0457b">${I.check(14)}</span><span style="background:#1f9e89"></span><span style="background:#f28c28"></span><span style="background:#2e86de"></span><span style="background:#a1519c"></span></div></div>
    </div>
    <div class="field"><div class="label">เป้าหมาย / คำอธิบาย <span class="r">ไม่บังคับ</span></div><div class="input" style="height:auto;min-height:56px;padding:10px 12px;font-size:12px;line-height:1.45;align-items:flex-start;background:#ffffff">พนักงานหยิบสินค้าตาม picking list บนมือถือ ยืนยันแล้วส่งผลกลับ LMS</div></div>
    <div class="frow">
      <div class="field"><div class="label">เจ้าของ</div><div class="input" style="background:#ffffff"><span style="display:flex;align-items:center;gap:8px"><span style="background:#e0457b;width:22px;height:22px;border-radius:999px;color:#fff;font-size:11px;display:inline-flex;align-items:center;justify-content:center">ด</span>สุดา</span>${I.chev(14)}</div></div>
      <div class="field"><div class="label">วาง Epic ไว้</div><div class="input" style="background:#ffffff"><span>ท้ายสุดของโปรเจกต์</span>${I.chev(14)}</div></div>
    </div>
  </div>

  <div class="secbox">
    <div class="sechead">2 · งานใน Epic <small>เลือกวิธีใส่งานได้ 3 แบบ</small></div>
    <div class="tabs" style="background:#ffffff"><span class="on">พิมพ์เอง</span><span>วางจาก Excel / รายการ</span><span>เลือกจากงานที่มีอยู่</span></div>
    <div class="rowh2"><span></span><span>ชื่องาน</span><span>ระยะเวลา</span><span></span></div>
    ${rowE('Picking list', 3)}
    ${rowE('Plant Route (Mobile)', 5)}
    ${rowE('Confirm', 2)}
    ${rowE('Import LMS', 3)}
    ${rowE('Import Due list', 2)}
    <div class="addstep" style="background:#ffffff">${I.plus(16)}<span>เพิ่มงาน · Enter ขึ้นแถวใหม่</span></div>
    <div class="optrow"><span style="width:120px">ลำดับงานข้างใน</span><div class="seg"><span class="on">ต่อกันตามลำดับ (FS)</span><span>ทำพร้อมกัน</span></div></div>
  </div>

  <div class="sumline">${I.info(14)}<span>Epic นี้จะยาว <b>15 วันทำงาน</b> · เริ่ม 29 ก.ย. เสร็จ <b>20 ต.ค. 2569</b> · แก้ทุกอย่างได้ทีหลังในแผง Epic</span></div>
  <div class="dlg-foot"><span class="spacer"></span><div class="btn ghost">ยกเลิก</div><div class="btn primary">${I.plus(16)}<span>สร้าง Epic + 5 งาน</span></div></div>
</div></div>`;

// ---------------- 4. mobile epics
const mcard = (e) => `<div class="mcard" style="--c:${e.c}">
  <div class="top"><h3>${e.n}</h3><span class="st ${e.s}">${stLabel[e.s]}</span></div>
  <div class="pbrow"><div class="pb"><div style="width:${e.pg}%"></div></div><span class="pct">${e.pg}%</span></div>
  <div class="meta"><span>งาน <b>${e.done}/${e.t}</b></span><span>${e.from} – ${e.to}</span><div class="avs">${e.who.map(w=>`<span class="av2" style="background:${who[w]}">${w}</span>`).join('')}</div></div>
</div>`;
const navIcon = (d, s) => icon(d, s);
const mobileEpics = `<div class="phone m">
  <div class="mhdr"><div class="ib" style="background:#ffd166;border-radius:10px;width:30px;height:30px"></div><div class="sw" style="flex:1;justify-content:center">ระบบ WMS ${I.chev(14)}</div><div class="ib">···</div></div>
  <div class="mpage">
    <div class="mtitle"><h1>Epics</h1><small>5 epics · 17 งาน · เสร็จ 5</small></div>
    <div class="mfilters"><span class="chip primary">ทั้งหมด 5</span><span class="chip soft">กำลังทำ 2</span><span class="chip">ล่าช้า 1</span><span class="chip soft">เสร็จ 1</span></div>
    ${EP.slice(0,4).map(mcard).join('')}
  </div>
  <div class="mfab">${I.plus(16)}<span>สร้าง Epic</span></div>
  <div class="bnav2">
    <div class="ni">${navIcon('<path d="M4 6h8"></path><path d="M9 12h9"></path><path d="M6 18h7"></path>', 22)}<span>Gantt</span></div>
    <div class="ni">${navIcon('<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M3 10h18"></path><path d="M8 3v4"></path><path d="M16 3v4"></path>', 22)}<span>ปฏิทิน</span></div>
    <div class="fab2">${I.plus(26)}</div>
    <div class="ni on">${navIcon('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>', 22)}<span>Epics</span></div>
    <div class="ni">${navIcon('<circle cx="9" cy="8" r="3.5"></circle><path d="M2.5 20a6.5 6.5 0 0 1 13 0"></path><path d="M16 4.5a3.5 3.5 0 0 1 0 7"></path><path d="M17.5 14a6 6 0 0 1 4 6"></path>', 22)}<span>ทรัพยากร</span></div>
  </div>
</div>`;

writeFileSync('EpicsPage.dc.html', wrap(epicsPage, { w: 1280, h: 720 }));
writeFileSync('GanttEpic.dc.html', wrap(ganttEpic, { w: 1280, h: 620 }));
writeFileSync('CreateEpic.dc.html', wrap(createEpic, { w: 760, h: 960 }));
writeFileSync('MobileEpics.dc.html', wrap(mobileEpics, { w: 390, h: 844 }));
console.log('built EpicsPage, GanttEpic, CreateEpic, MobileEpics');
