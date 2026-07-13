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
let timers = {};

/* ── storage ── */
function loadData(cb) {
  chrome.storage.local.get(["mk_data", "mk_timers"], r => {
    allData = r.mk_data || {};
    timers = r.mk_timers || {};
    cb();
  });
}
function saveData() { chrome.storage.local.set({ mk_data: allData }); }
function saveTimers() { chrome.storage.local.set({ mk_timers: timers }); }
function getDay(d) { return allData[d] || Object.fromEntries(CATS.map(c=>[c.key,0])); }

function fmtTimer(ms) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h + ":" + String(m).padStart(2,"0") + ":" + String(s).padStart(2,"0");
}
function getTimerMs(key) {
  const t = timers[key];
  if (!t) return 0;
  const acc = t.accumulated || 0;
  return t.startedAt ? acc + (Date.now() - t.startedAt) : acc;
}
function isRunning(key) { return !!(timers[key] && timers[key].startedAt); }

/* ══════════════════════ INIT ══════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  loadData(() => {
    buildSliders();
    $("#dateInput").value = selectedDate;
    syncSlidersToDate();
    updateDisplay();
    renderHistory();
    populateMonths();
    setInterval(tickTimers, 1000);
  });

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
    updateDisplay();
  });

  $("#monthSelect").addEventListener("change", renderMonthly);
});

/* ══════════════════════ TIMER TICK ══════════════════════ */
function tickTimers() {
  CATS.forEach(c => {
    if (isRunning(c.key)) {
      const ms = getTimerMs(c.key);
      const disp = $(`#td_${c.key}`);
      if (disp) {
        disp.textContent = fmtTimer(ms);
        disp.classList.add("running");
      }
      // auto-update slider (snap to 0.25h)
      const hours = Math.round((ms / 3600000) * 4) / 4;
      const sl = $(`#sl_${c.key}`);
      if (sl && parseFloat(sl.value) !== hours) {
        sl.value = hours;
        updateDisplay();
      }
    }
  });
}

/* ══════════════════════ BUILD SLIDERS + TIMERS ══════════════════════ */
function buildSliders() {
  const box = $("#sliders");
  box.innerHTML = "";

  CATS.forEach(c => {
    const row = document.createElement("div");
    row.className = "cat-row";

    // Dot
    const dot = document.createElement("span");
    dot.className = "cat-dot";
    dot.style.background = c.color;
    row.appendChild(dot);

    // Label
    const lbl = document.createElement("span");
    lbl.className = "cat-label";
    lbl.title = c.label;
    lbl.textContent = c.label;
    row.appendChild(lbl);

    // Slider
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0"; slider.max = "16"; slider.step = "0.25"; slider.value = "0";
    slider.id = `sl_${c.key}`;
    slider.className = "cat-slider";
    slider.style.accentColor = c.color;
    slider.addEventListener("input", () => updateDisplay());
    row.appendChild(slider);

    // Value label
    const val = document.createElement("span");
    val.className = "cat-val";
    val.id = `vl_${c.key}`;
    val.textContent = "0h";
    row.appendChild(val);

    // Timer box
    const tbox = document.createElement("div");
    tbox.className = "timer-box";

    // Timer display
    const td = document.createElement("span");
    td.className = "timer-display";
    td.id = `td_${c.key}`;
    td.textContent = "0:00:00";
    tbox.appendChild(td);

    // PLAY button
    const playBtn = document.createElement("button");
    playBtn.className = "t-btn play-btn";
    playBtn.id = `bp_${c.key}`;
    playBtn.title = "Start timer";
    playBtn.innerHTML = "&#9654;";  // ▶
    playBtn.addEventListener("click", () => startTimer(c.key));
    tbox.appendChild(playBtn);

    // PAUSE button
    const pauseBtn = document.createElement("button");
    pauseBtn.className = "t-btn pause-btn";
    pauseBtn.id = `bpa_${c.key}`;
    pauseBtn.title = "Pause timer";
    pauseBtn.innerHTML = "&#10074;&#10074;"; // ❚❚
    pauseBtn.style.display = "none";
    pauseBtn.addEventListener("click", () => pauseTimer(c.key));
    tbox.appendChild(pauseBtn);

    // STOP button
    const stopBtn = document.createElement("button");
    stopBtn.className = "t-btn stop-btn";
    stopBtn.id = `bs_${c.key}`;
    stopBtn.title = "Stop & reset timer";
    stopBtn.innerHTML = "&#9632;";  // ■
    stopBtn.addEventListener("click", () => stopTimer(c.key));
    tbox.appendChild(stopBtn);

    row.appendChild(tbox);
    box.appendChild(row);

    // Restore running timer display
    if (timers[c.key]) {
      td.textContent = fmtTimer(getTimerMs(c.key));
      if (isRunning(c.key)) td.classList.add("running");
      refreshButtons(c.key);
    }
  });
}

function startTimer(key) {
  if (!timers[key]) timers[key] = { startedAt: null, accumulated: 0 };
  // seed from slider if timer was fresh
  const slMs = parseFloat($(`#sl_${key}`).value) * 3600000;
  if (!timers[key].startedAt && timers[key].accumulated === 0 && slMs > 0) {
    timers[key].accumulated = slMs;
  }
  timers[key].startedAt = Date.now();
  saveTimers();
  refreshButtons(key);
}

function pauseTimer(key) {
  if (timers[key] && timers[key].startedAt) {
    timers[key].accumulated += Date.now() - timers[key].startedAt;
    timers[key].startedAt = null;
    saveTimers();
    const hours = Math.round((timers[key].accumulated / 3600000) * 4) / 4;
    $(`#sl_${key}`).value = hours;
    $(`#td_${key}`).classList.remove("running");
    updateDisplay();
    refreshButtons(key);
  }
}

function stopTimer(key) {
  if (timers[key] && (timers[key].startedAt || timers[key].accumulated > 0)) {
    const ms = getTimerMs(key);
    const hours = Math.round((ms / 3600000) * 4) / 4;
    $(`#sl_${key}`).value = hours;
  }
  timers[key] = null;
  saveTimers();
  $(`#td_${key}`).textContent = "0:00:00";
  $(`#td_${key}`).classList.remove("running");
  refreshButtons(key);
  updateDisplay();
}

function refreshButtons(key) {
  const running = isRunning(key);
  $(`#bp_${key}`).style.display  = running ? "none" : "flex";
  $(`#bpa_${key}`).style.display = running ? "flex" : "none";
}

function syncSlidersToDate() {
  const d = getDay(selectedDate);
  CATS.forEach(c => { $(`#sl_${c.key}`).value = d[c.key] || 0; });
}

function updateDisplay() {
  const hours = {};
  let total = 0;
  CATS.forEach(c => {
    const v = parseFloat($(`#sl_${c.key}`).value);
    hours[c.key] = v;
    $(`#vl_${c.key}`).textContent = v + "h";
    total += v;
  });
  const badge = $("#totalBadge");
  badge.textContent = total + "h / 24h";
  badge.classList.toggle("over", total > 24);
  $("#overWarning").hidden = total <= 24;
  allData[selectedDate] = hours;
  saveData();
  drawPie($("#pieCanvas"), hours, total);
}

/* ══════════════════════ PIE CHART ══════════════════════ */
function drawPie(canvas, hours, total) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const cx = W/2, cy = H/2 - 15, R = 110, r = 52;
  ctx.clearRect(0, 0, W, H);

  const slices = CATS.map(c => ({ label:c.label, val:hours[c.key]||0, color:c.color }))
    .filter(s => s.val > 0);
  const free = 24 - total;
  if (free > 0) slices.push({ label:"Untracked", val:Math.round(free*100)/100, color:"#ddd" });
  const sum = slices.reduce((a,s) => a + s.val, 0);
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
    if (sweep > 0.25) {
      const mid = angle + sweep / 2;
      ctx.fillStyle = "#fff"; ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(Math.round(s.val/sum*100) + "%",
        cx + (R+r)/2 * Math.cos(mid), cy + (R+r)/2 * Math.sin(mid));
    }
    angle += sweep;
  });

  // legend
  const ly0 = cy + R + 20;
  const cols = 2, colW = W / cols;
  slices.forEach((s, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const lx = col * colW + 14, ly = ly0 + row * 16;
    if (ly > H - 6) return;
    ctx.fillStyle = s.color;
    ctx.fillRect(lx, ly, 10, 10);
    ctx.fillStyle = "#333"; ctx.font = "12px sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText(s.label + " " + s.val + "h", lx + 14, ly - 1);
  });
}

/* ══════════════════════ HISTORY ══════════════════════ */
function renderHistory() {
  const box = $("#historyList");
  const dates = Object.keys(allData).sort().reverse();
  if (!dates.length) { box.innerHTML = '<p class="empty">No entries yet. Start logging in Daily Log.</p>'; return; }
  box.innerHTML = "";
  dates.forEach(d => {
    const day = allData[d];
    const total = CATS.reduce((a,c) => a + (day[c.key]||0), 0);
    if (total === 0) return;
    const top = CATS.map(c => ({ label:c.label, val:day[c.key]||0, color:c.color }))
      .filter(x => x.val > 0).sort((a,b) => b.val - a.val).slice(0, 3);
    const item = document.createElement("div");
    item.className = "hist-item";
    item.innerHTML =
      `<span class="hist-date">${d}</span>` +
      `<span class="hist-total">${total}h</span>` +
      `<div class="hist-tags">${top.map(t =>
        `<span class="hist-tag" style="background:${t.color}22;color:${t.color}">${t.label} ${t.val}h</span>`
      ).join("")}</div>`;
    item.addEventListener("click", () => {
      selectedDate = d; $("#dateInput").value = d;
      syncSlidersToDate(); updateDisplay();
      $$(".tab").forEach(b => b.classList.remove("active"));
      $$(".tab")[0].classList.add("active");
      ["log","history","monthly"].forEach(v => $(`#view-${v}`).hidden = (v !== "log"));
    });
    box.appendChild(item);
  });
}

/* ══════════════════════ MONTHLY ══════════════════════ */
function populateMonths() {
  const sel = $("#monthSelect");
  const months = [...new Set(Object.keys(allData).map(d => d.slice(0,7)))].sort().reverse();
  const cur = todayStr().slice(0,7);
  if (!months.includes(cur)) months.unshift(cur);
  sel.innerHTML = months.map(m => `<option value="${m}">${m}</option>`).join("");
}

function renderMonthly() {
  const month = $("#monthSelect").value;
  $("#monthTitle").textContent = "Total Hours — " + month;
  const dates = Object.keys(allData).filter(d => d.startsWith(month));
  const totals = Object.fromEntries(CATS.map(c => [c.key, 0]));
  dates.forEach(d => CATS.forEach(c => { totals[c.key] += (allData[d]?.[c.key] || 0); }));
  const data = CATS.map(c => ({ label:c.label, val:Math.round(totals[c.key]*10)/10, color:c.color }))
    .filter(d => d.val > 0).sort((a,b) => b.val - a.val);
  drawBar($("#barCanvas"), data);
  drawMonthPie($("#monthPieCanvas"), data);
}

function drawBar(canvas, data) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  if (!data.length) { ctx.fillStyle="#888"; ctx.font="13px sans-serif"; ctx.fillText("No data for this month.", W/2-60, H/2); return; }
  const maxVal = Math.max(...data.map(d => d.val));
  const leftPad = 140, rightPad = 40, topPad = 10;
  const barH = Math.min(24, (H - topPad) / data.length - 5);
  const chartW = W - leftPad - rightPad;
  data.forEach((d, i) => {
    const y = topPad + i * (barH + 6);
    const w = (d.val / maxVal) * chartW;
    ctx.fillStyle = d.color;
    ctx.beginPath(); ctx.roundRect(leftPad, y, Math.max(w, 2), barH, [0, 6, 6, 0]); ctx.fill();
    ctx.fillStyle = "#333"; ctx.font = "12px sans-serif";
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.fillText(d.label, leftPad - 8, y + barH/2);
    ctx.fillStyle = "#555"; ctx.textAlign = "left";
    ctx.fillText(d.val + "h", leftPad + w + 6, y + barH/2);
  });
}

function drawMonthPie(canvas, data) {
  const total = data.reduce((a,d) => a + d.val, 0);
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const cx = W/2, cy = H/2 - 10, R = 100, r = 48;
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
    ctx.fillStyle = s.color; ctx.fill();
    if (sweep > 0.3) {
      const mid = angle + sweep/2;
      ctx.fillStyle = "#fff"; ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(Math.round(s.val/total*100) + "%",
        cx + (R+r)/2*Math.cos(mid), cy + (R+r)/2*Math.sin(mid));
    }
    angle += sweep;
  });
  const ly0 = cy + R + 18; const cols = 2, colW = W / cols;
  data.forEach((s, i) => {
    const col = i%cols, row = Math.floor(i/cols);
    const lx = col*colW + 14, ly = ly0 + row * 16;
    if (ly > H - 6) return;
    ctx.fillStyle = s.color; ctx.fillRect(lx, ly, 10, 10);
    ctx.fillStyle = "#333"; ctx.font = "12px sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText(s.label + " " + s.val + "h", lx + 14, ly - 1);
  });
}
