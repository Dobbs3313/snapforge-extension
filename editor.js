const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const statusEl = document.getElementById("statusText");
let tool = "arrow";
let color = "#fb923c";
let history = [];
let drawing = false;
let sx = 0, sy = 0;
let snapshot = null;

function setStatus(s) { statusEl.textContent = s; }

function pushHistory() {
  history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  if (history.length > 25) history.shift();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawArrow(x1, y1, x2, y2) {
  const head = 16;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

function pixelateRect(x, y, w, h, block = 12) {
  const rx = Math.max(0, Math.floor(Math.min(x, x + w)));
  const ry = Math.max(0, Math.floor(Math.min(y, y + h)));
  const rw = Math.min(canvas.width - rx, Math.abs(Math.floor(w)));
  const rh = Math.min(canvas.height - ry, Math.abs(Math.floor(h)));
  if (rw < 4 || rh < 4) return;
  const imgData = ctx.getImageData(rx, ry, rw, rh);
  const d = imgData.data;
  for (let by = 0; by < rh; by += block) {
    for (let bx = 0; bx < rw; bx += block) {
      const idx = (by * rw + bx) * 4;
      const r = d[idx], g = d[idx + 1], b = d[idx + 2], a = d[idx + 3];
      for (let py = by; py < Math.min(by + block, rh); py++) {
        for (let px = bx; px < Math.min(bx + block, rw); px++) {
          const i = (py * rw + px) * 4;
          d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a;
        }
      }
    }
  }
  ctx.putImageData(imgData, rx, ry);
}

function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height)
  };
}

canvas.addEventListener("mousedown", (e) => {
  const p = canvasPos(e);
  if (tool === "text") {
    const txt = prompt("Enter annotation text:");
    if (txt) {
      pushHistory();
      ctx.font = "bold 24px system-ui, sans-serif";
      ctx.fillStyle = color;
      ctx.fillText(txt, p.x, p.y);
      setStatus("Added text");
    }
    return;
  }
  pushHistory();
  drawing = true;
  sx = p.x; sy = p.y;
  snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
  if (tool === "pen") {
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(sx, sy);
  }
});

canvas.addEventListener("mousemove", (e) => {
  if (!drawing) return;
  const p = canvasPos(e);
  if (tool === "pen") {
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    return;
  }
  ctx.putImageData(snapshot, 0, 0);
  if (tool === "arrow") {
    drawArrow(sx, sy, p.x, p.y);
  } else if (tool === "rect") {
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.strokeRect(sx, sy, p.x - sx, p.y - sy);
  } else if (tool === "highlight") {
    ctx.fillStyle = "rgba(251, 191, 36, 0.35)";
    ctx.fillRect(sx, sy, p.x - sx, p.y - sy);
  } else if (tool === "blur") {
    pixelateRect(sx, sy, p.x - sx, p.y - sy, 14);
  }
});

window.addEventListener("mouseup", () => {
  if (drawing) {
    drawing = false;
    setStatus(`Applied ${tool}`);
  }
});

document.querySelectorAll("[data-tool]").forEach(btn => {
  btn.addEventListener("click", () => {
    tool = btn.dataset.tool;
    document.querySelectorAll("[data-tool]").forEach(b => b.classList.toggle("active", b === btn));
  });
});

document.getElementById("colorPicker").addEventListener("input", e => { color = e.target.value; });
document.getElementById("undoBtn").addEventListener("click", () => {
  if (!history.length) return setStatus("Nothing to undo");
  ctx.putImageData(history.pop(), 0, 0);
  setStatus("Undid last action");
});

document.getElementById("copyBtn").addEventListener("click", () => {
  canvas.toBlob(async (blob) => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setStatus("Copied PNG to clipboard!");
    } catch {
      setStatus("Clipboard denied — use PNG download.");
    }
  }, "image/png");
});

function saveAs(mime, ext) {
  const a = document.createElement("a");
  a.href = canvas.toDataURL(mime, 0.92);
  a.download = `snapforge-${Date.now()}.${ext}`;
  a.click();
  setStatus(`Saved ${ext.toUpperCase()}`);
}

document.getElementById("dlPngBtn").addEventListener("click", () => saveAs("image/png", "png"));
document.getElementById("dlWebpBtn").addEventListener("click", () => saveAs("image/webp", "webp"));
document.getElementById("printBtn").addEventListener("click", () => window.print());

async function init() {
  const params = new URLSearchParams(location.search);
  if (params.get("mode") === "record") {
    document.getElementById("editorStage").classList.add("hidden");
    document.getElementById("recordStage").classList.remove("hidden");
    const wantAudio = params.get("audio") !== "0";
    let recorder = null, chunks = [];
    document.getElementById("recStartBtn").addEventListener("click", async () => {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: wantAudio });
        chunks = [];
        recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
        recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: "video/webm" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `snapforge-recording-${Date.now()}.webm`;
          a.click();
          stream.getTracks().forEach(t => t.stop());
          document.getElementById("recStatus").textContent = "Saved WebM download!";
          document.getElementById("recStartBtn").disabled = false;
          document.getElementById("recStopBtn").disabled = true;
        };
        recorder.start();
        document.getElementById("recStartBtn").disabled = true;
        document.getElementById("recStopBtn").disabled = false;
        document.getElementById("recStatus").textContent = "● Recording...";
      } catch (err) {
        document.getElementById("recStatus").textContent = `Canceled: ${err.message}`;
      }
    });
    document.getElementById("recStopBtn").addEventListener("click", () => recorder?.stop());
    return;
  }

  const { sf_latest_capture } = await chrome.storage.local.get("sf_latest_capture");
  if (!sf_latest_capture) {
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "20px system-ui";
    ctx.fillText("Click the SnapForge toolbar icon on any page to capture.", 160, 270);
    return;
  }

  if (sf_latest_capture.slices?.length) {
    const first = await loadImage(sf_latest_capture.slices[0].dataUrl);
    const dpr = sf_latest_capture.metrics?.dpr || 1;
    const totalH = Math.round((sf_latest_capture.metrics?.scrollHeight || first.height) * dpr);
    canvas.width = first.width;
    canvas.height = Math.min(totalH, 16000);
    for (const s of sf_latest_capture.slices) {
      const im = await loadImage(s.dataUrl);
      ctx.drawImage(im, 0, Math.round(s.y * dpr));
    }
    setStatus(`Stitched ${sf_latest_capture.slices.length} slices (${canvas.width}×${canvas.height})`);
  } else if (sf_latest_capture.dataUrl) {
    const img = await loadImage(sf_latest_capture.dataUrl);
    const crop = sf_latest_capture.crop;
    if (crop && crop.w > 10 && crop.h > 10) {
      canvas.width = crop.w;
      canvas.height = crop.h;
      ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
    } else {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
    }
    setStatus(`${canvas.width}×${canvas.height} · Ready to annotate`);
  }
}

init();
