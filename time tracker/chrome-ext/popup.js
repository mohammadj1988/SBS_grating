/* ── categories ── */
const CATS = [
  { key:"sbs",         label:"SBS & Spectroscopy",  color:"#1a5276" },
  { key:"laser",       label:"Laser & Photonics",   color:"#27ae60" },
  { key:"ai",          label:"AI",                  color:"#7f8c8d" },
  { key:"math",        label:"Mathematics",         color:"#6c3483" },
  { key:"ielts",       label:"IELTS",               color:"#e91e8b" },
  { key:"crypto",      label:"Crypto / Economy",    color:"#5b2c8e" },
  { key:"bio",         label:"Bio & Chemistry",     color:"#a2b814" },
  { key:"electronics", label:"Electronics",         color:"#e67e22" },
  { key:"mechanics",   label:"Mechanics & Design",  color:"#138d75" },
  { key:"general",     label:"General",             color:"#d4ac0d" },
];

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const todayStr = () => new Date().toISOString().split("T")[0];

let allData = {};
let selectedDate = todayStr();

/* ── storage helpers (chrome.storage.local) ── */
function loadData(cb) {
  chrome.storage.local.get("mk_data", r => { allData = r.mk_data || {}; cb(); });
}
function saveData() {
  chrome.storage.local.set({ mk_data: allData });
}
function getDay(d) { return allData[d] || Object.fromEntries(CATS.map(c=>[c.key,0])); }

/* ══════════════════════ INIT ══════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  loadData(() => {
    buildSliders();
    $("#dateInput").value = selectedDate;
    updateFromSliders();
    renderHistory();
    populateMonths();
  });

  /* tabs */
  $$(".tab").forEach(t => t.addEventListener("click", () => {
    $$(".tab").forEach(b => b.classList.remove("active"));
    t.classList.add("active");
    ["log","history","monthly"].forEach(v =>
      $(`#view-${v}`).hidden = (v !== t.dataset.view));
    if (t.dataset.view === "history") renderHistory();
    if (t.dataset.view === "monthly") { populateMonths(); renderMonthly(); }
  }));

  $("#dateInput").addEventListener("change", e => {
    selectedDate = e.target.value;
    syncSlidersToDate();
    updateFromSliders();
  });

  $("#monthSelect").addEventListener("change", renderMonthly);
});

/* ══════════════════════ SLIDERS ══════════════════════ */
function buildSliders() {
  const box = $("#sliders");
  box.innerHTML = "";
  CATS.forEach(c => {
    const row = document.createElement("div");
    row.className = "slider-row";
    row.innerHTML = `
      <span class="dot" style="background:${c.color}"></span>
      <span class="lbl">${c.label}</span>
      <input type="range" min="0" max="16" step="0.25" value="0"
             id="sl_${c.key}" style="accent-color:${c.color}">
      <span class="val" id="vl_${c.key}">0h</span>`;
    box.appendChild(row);
    row.querySelector("input").addEventListener("input", () => updateFromSliders());
  });
}

function syncSlidersToDate() {
  const d = getDay(selectedDate);
  CATS.forEach(c => {
    $(`#sl_${c.key}`).value = d[c.key] || 0;
  });
}

function updateFromSliders() {
  const hours = {};
  let total = 0;
  CATS.forEach(c => {
    const v = parseFloat($(`#sl_${c.key}`).value);
    hours[c.key] = v;
    $(`#vl_${c.key}`).textContent = v + "h";
    total += v;
  });
  const badge = $("#totalBadge");
  badge.textContent = `${total}h / 24h`;
  badge.classList.toggle("over", total > 24);
  $("#overWarning").hidden = total <= 24;

  // save
  allData[selectedDate] = hours;
  saveData();

  drawPie($("#pieCanvas"), hours, total);
}

/* ══════════════════════ PIE CHART ══════════════════════ */
function drawPie(canvas, hours, total) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2 - 10, R = 105, r = 50;
  ctx.clearRect(0, 0, W, H);

  const slices = CATS.map(c => ({ label: c.label, val: hours[c.key]||0, color: c.color }))
    .filter(s => s.val > 0);
  const free = 24 - total;
  if (free > 0) slices.push({ label:"Untracked", val: Math.round(free*100)/100, color:"#ddd" });
  const sum = slices.reduce((a,s)=>a+s.val,0);
  if (sum === 0) return;

  let angle = -Math.PI / 2;
  slices.forEach(s => {
    const sweep = (s.val / sum) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + r*Math.cos(angle), cy + r*Math.sin(angle));
    ctx.arc(cx, cy, R, angle, angle + sweep);
    ctx.arc(cx, cy, r, angle + sweep, angle, true);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.fill();

    // label if slice big enough
    if (sweep > 0.3) {
      const mid = angle + sweep / 2;
      const lx = cx + (R + r) / 2 * Math.cos(mid);
      const ly = cy + (R + r) / 2 * Math.sin(mid);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(Math.round(s.val / sum * 100) + "%", lx, ly);
    }
    angle += sweep;
  });

  // legend
  const legendY = cy + R + 18;
  const cols = 2, colW = W / cols;
  slices.forEach((s, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const lx = col * colW + 10, ly = legendY + row * 14;
    if (ly > H - 4) return;
    ctx.fillStyle = s.color;
    ctx.fillRect(lx, ly, 8, 8);
    ctx.fillStyle = "#333";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`${s.label} ${s.val}h`, lx + 12, ly - 1);
  });
}

/* ══════════════════════ HISTORY ══════════════════════ */
function renderHistory() {
  const box = $("#historyList");
  const dates = Object.keys(allData).sort().reverse();
  if (!dates.length) { box.innerHTML = '<p class="empty">No entries yet.</p>'; return; }
  box.innerHTML = "";
  dates.forEach(d => {
    const day = allData[d];
    const total = CATS.reduce((a,c) => a + (day[c.key]||0), 0);
    if (total === 0) return;
    const top = CATS.map(c => ({ label:c.label, val:day[c.key]||0, color:c.color }))
      .filter(x=>x.val>0).sort((a,b)=>b.val-a.val).slice(0,3);

    const item = document.createElement("div");
    item.className = "hist-item";
    item.innerHTML = `
      <span class="hist-date">${d}</span>
      <span class="hist-total">${total}h</span>
      <div class="hist-tags">
        ${top.map(t => `<span class="hist-tag" style="background:${t.color}22;color:${t.color}">${t.label} ${t.val}h</span>`).join("")}
      </div>`;
    item.addEventListener("click", () => {
      selectedDate = d;
      $("#dateInput").value = d;
      syncSlidersToDate();
      updateFromSliders();
      $$(".tab").forEach(b => b.classList.remove("active"));
      $$(".tab")[0].classList.add("active");
      ["log","history","monthly"].forEach(v => $(`#view-${v}`).hidden = (v!=="log"));
    });
    box.appendChild(item);
  });
}

/* ══════════════════════ MONTHLY ══════════════════════ */
function populateMonths() {
  const sel = $("#monthSelect");
  const months = [...new Set(Object.keys(allData).map(d=>d.slice(0,7)))].sort().reverse();
  const cur = todayStr().slice(0,7);
  if (!months.includes(cur)) months.unshift(cur);
  sel.innerHTML = months.map(m => `<option value="${m}">${m}</option>`).join("");
}

function renderMonthly() {
  const month = $("#monthSelect").value;
  $("#monthTitle").textContent = `Total Hours — ${month}`;
  const dates = Object.keys(allData).filter(d => d.startsWith(month));
  const totals = Object.fromEntries(CATS.map(c=>[c.key,0]));
  dates.forEach(d => CATS.forEach(c => { totals[c.key] += (allData[d]?.[c.key]||0); }));

  const data = CATS.map(c => ({ label:c.label, val: Math.round(totals[c.key]*10)/10, color:c.color }))
    .filter(d=>d.val>0).sort((a,b)=>b.val-a.val);

  drawBar($("#barCanvas"), data);
  drawMonthPie($("#monthPieCanvas"), data);
}

function drawBar(canvas, data) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  if (!data.length) { ctx.fillStyle="#888"; ctx.font="12px sans-serif"; ctx.fillText("No data",W/2-20,H/2); return; }

  const maxVal = Math.max(...data.map(d=>d.val));
  const leftPad = 130, rightPad = 30, topPad = 10;
  const barH = Math.min(22, (H - topPad) / data.length - 4);
  const chartW = W - leftPad - rightPad;

  data.forEach((d, i) => {
    const y = topPad + i * (barH + 5);
    const w = (d.val / maxVal) * chartW;

    // bar
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.roundRect(leftPad, y, w, barH, [0, 5, 5, 0]);
    ctx.fill();

    // label
    ctx.fillStyle = "#333";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(d.label, leftPad - 6, y + barH/2);

    // value
    ctx.fillStyle = "#555";
    ctx.textAlign = "left";
    ctx.fillText(d.val + "h", leftPad + w + 5, y + barH/2);
  });
}

function drawMonthPie(canvas, data) {
  const total = data.reduce((a,d)=>a+d.val,0);
  const hours = Object.fromEntries(data.map(d=>[d.label, d.val]));
  // reuse drawPie format
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const cx = W/2, cy = H/2 - 10, R = 95, r = 45;
  ctx.clearRect(0, 0, W, H);
  if (total === 0) return;

  let angle = -Math.PI / 2;
  data.forEach(s => {
    const sweep = (s.val / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + r*Math.cos(angle), cy + r*Math.sin(angle));
    ctx.arc(cx, cy, R, angle, angle + sweep);
    ctx.arc(cx, cy, r, angle + sweep, angle, true);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.fill();
    if (sweep > 0.3) {
      const mid = angle + sweep/2;
      ctx.fillStyle = "#fff";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(Math.round(s.val/total*100)+"%", cx+(R+r)/2*Math.cos(mid), cy+(R+r)/2*Math.sin(mid));
    }
    angle += sweep;
  });

  // legend
  const ly0 = cy + R + 16;
  const cols = 2, colW = W / cols;
  data.forEach((s, i) => {
    const col = i%cols, row = Math.floor(i/cols);
    const lx = col*colW+10, ly = ly0 + row*14;
    if (ly > H-4) return;
    ctx.fillStyle = s.color;
    ctx.fillRect(lx,ly,8,8);
    ctx.fillStyle = "#333";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`${s.label} ${s.val}h`, lx+12, ly-1);
  });
}
