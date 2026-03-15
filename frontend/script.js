/* ── Config ──────────────────────────────────────────────────────────── */
const API_BASE = "https://nayaksneha-summarizer-ai.hf.space";
const MAX_FILE_MB   = 5;
const MAX_CHARS     = 50_000;

/* ── State ───────────────────────────────────────────────────────────── */
let activeTab       = "text";
let selectedMode    = "brief";
let selectedFile    = null;

/* ── Noise texture (canvas) ──────────────────────────────────────────── */
(function initNoise() {
  const canvas = document.getElementById("noise");
  const ctx    = canvas.getContext("2d");
  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    drawNoise();
  }
  function drawNoise() {
    const img = ctx.createImageData(canvas.width, canvas.height);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255 | 0;
      img.data[i] = img.data[i+1] = img.data[i+2] = v;
      img.data[i+3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();
})();

/* ── Load modes from API ─────────────────────────────────────────────── */
async function loadModes() {
  try {
    const r    = await fetch(`${API_BASE}/modes`);
    const list = await r.json();
    renderModes(list);
  } catch {
    renderModes([
      { key: "brief",    label: "Brief" },
      { key: "detailed", label: "Detailed" },
      { key: "tldr",     label: "TL;DR" },
      { key: "short",    label: "Short" },
      { key: "medium",   label: "Medium" },
      { key: "long",     label: "Long" },
    ]);
  }
}

function renderModes(list) {
  const grid = document.getElementById("mode-grid");
  grid.innerHTML = "";
  list.forEach(m => {
    const btn = document.createElement("button");
    btn.className = "mode-btn" + (m.key === selectedMode ? " selected" : "");
    btn.textContent = m.label;
    btn.dataset.key = m.key;
    btn.onclick = () => selectMode(m.key);
    grid.appendChild(btn);
  });
}

function selectMode(key) {
  selectedMode = key;
  document.querySelectorAll(".mode-btn").forEach(b => {
    b.classList.toggle("selected", b.dataset.key === key);
  });
}

/* ── Tabs ────────────────────────────────────────────────────────────── */
function switchTab(tab) {
  activeTab = tab;
  document.getElementById("panel-text").classList.toggle("hidden", tab !== "text");
  document.getElementById("panel-file").classList.toggle("hidden", tab !== "file");
  document.getElementById("tab-text").classList.toggle("active", tab === "text");
  document.getElementById("tab-file").classList.toggle("active", tab === "file");
  hideResult(); hideError();
}

/* ── Char counter ────────────────────────────────────────────────────── */
function updateCharCount() {
  const len = document.getElementById("input-text").value.length;
  const el  = document.getElementById("char-used");
  el.textContent = len.toLocaleString();
  el.closest(".char-count").classList.toggle("warn", len > MAX_CHARS * 0.9);
}

/* ── File handling ───────────────────────────────────────────────────── */
function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) setFile(file);
}

function setFile(file) {
  const mb = file.size / (1024 * 1024);
  if (mb > MAX_FILE_MB) {
    showError(`File is ${mb.toFixed(1)} MB. Maximum allowed is ${MAX_FILE_MB} MB.`);
    return;
  }
  selectedFile = file;
  document.getElementById("drop-zone").classList.add("hidden");
  const info = document.getElementById("file-info");
  info.classList.remove("hidden");
  document.getElementById("file-name").textContent = file.name;
  document.getElementById("file-size").textContent = `${mb.toFixed(2)} MB`;
  hideError();
}

function clearFile() {
  selectedFile = null;
  document.getElementById("file-input").value = "";
  document.getElementById("file-info").classList.add("hidden");
  document.getElementById("drop-zone").classList.remove("hidden");
}

/* ── Drag & drop ─────────────────────────────────────────────────────── */
(function initDragDrop() {
  const zone = document.getElementById("drop-zone");
  zone.addEventListener("dragover", e => { e.preventDefault(); zone.classList.add("drag-over"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
  zone.addEventListener("drop", e => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) setFile(file);
  });
})();

/* ── Main summarize ──────────────────────────────────────────────────── */
async function summarize() {
  hideResult(); hideError();

  const btn   = document.getElementById("btn-go");
  const label = document.getElementById("btn-label");
  const icon  = document.getElementById("btn-icon");

  btn.disabled = true;
  label.textContent = "Summarizing…";
  icon.textContent  = "⟳";

  try {
    let response;

    if (activeTab === "file") {
      if (!selectedFile) { showError("Please select a file to upload."); return; }
      const form = new FormData();
      form.append("file", selectedFile);
      form.append("mode", selectedMode);
      response = await fetch(`${API_BASE}/summarize`, { method: "POST", body: form });

    } else {
      const text = document.getElementById("input-text").value.trim();
      if (!text) { showError("Please paste some text before summarizing."); return; }
      if (text.length > MAX_CHARS) {
        showError(`Text is too long (${text.length.toLocaleString()} chars). Max is ${MAX_CHARS.toLocaleString()}.`);
        return;
      }
      response = await fetch(`${API_BASE}/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, mode: selectedMode }),
      });
    }

    const data = await response.json();

    if (!response.ok || data.error) {
      showError(data.error || `Server error (${response.status}).`);
      return;
    }

    showResult(data);

  } catch (err) {
    showError("Could not reach the server. Please try again.");
  } finally {
    btn.disabled = false;
    label.textContent = "Generate Summary";
    icon.textContent  = "→";
  }
}

/* ── Result / error helpers ──────────────────────────────────────────── */
const modeLabels = {
  brief: "Brief", detailed: "Detailed", tldr: "TL;DR",
  short: "Short", medium: "Medium", long: "Long",
};

function showResult(data) {
  const area = document.getElementById("result-area");
  document.getElementById("result-badge").textContent  = modeLabels[data.mode] || data.mode;
  document.getElementById("result-chars").textContent  = `from ${(data.input_chars || 0).toLocaleString()} chars`;
  document.getElementById("result-body").textContent   = data.summary;
  area.classList.remove("hidden");
  area.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function hideResult() {
  document.getElementById("result-area").classList.add("hidden");
}

function showError(msg) {
  const el = document.getElementById("error-area");
  document.getElementById("error-msg").textContent = msg;
  el.classList.remove("hidden");
}

function hideError() {
  document.getElementById("error-area").classList.add("hidden");
}

/* ── Copy to clipboard ───────────────────────────────────────────────── */
function copyResult() {
  const text = document.getElementById("result-body").textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById("copy-btn");
    btn.textContent = "✓ Copied!";
    setTimeout(() => btn.textContent = "⎘ Copy", 1800);
  });
}

/* ── Init ────────────────────────────────────────────────────────────── */
loadModes();