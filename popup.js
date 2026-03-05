const els = {
  prompts: document.getElementById("prompts"),
  delaySec: document.getElementById("delaySec"),
  timeoutSec: document.getElementById("timeoutSec"),
  pickFileBtn: document.getElementById("pickFileBtn"),
  clearBtn: document.getElementById("clearBtn"),
  fileInput: document.getElementById("fileInput"),
  fileInfo: document.getElementById("fileInfo"),
  promptCount: document.getElementById("promptCount"),
  startBtn: document.getElementById("startBtn"),
  stopBtn: document.getElementById("stopBtn"),
  status: document.getElementById("status"),
};

function setStatus(text) {
  els.status.textContent = text;
}

function parsePrompts(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function updatePromptCount() {
  const count = parsePrompts(els.prompts.value).length;
  els.promptCount.textContent = `Кількість промптів: ${count}`;
}

function setFileInfo(text) {
  els.fileInfo.textContent = text;
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function isSoraTab(tab) {
  return Boolean(tab?.url && tab.url.startsWith("https://sora.chatgpt.com/"));
}

async function sendToTab(tabId, message) {
  return chrome.tabs.sendMessage(tabId, message);
}

function safeNumber(value, fallback, min) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return Math.max(min, num);
}

async function saveForm() {
  await chrome.storage.local.set({
    soraQueuePrompts: els.prompts.value,
    soraQueueDelaySec: els.delaySec.value,
    soraQueueTimeoutSec: els.timeoutSec.value,
  });
}

async function restoreForm() {
  const data = await chrome.storage.local.get([
    "soraQueuePrompts",
    "soraQueueDelaySec",
    "soraQueueTimeoutSec",
    "soraQueueFileInfo",
  ]);

  if (typeof data.soraQueuePrompts === "string") {
    els.prompts.value = data.soraQueuePrompts;
  }
  if (data.soraQueueDelaySec != null) {
    els.delaySec.value = data.soraQueueDelaySec;
  }
  if (data.soraQueueTimeoutSec != null) {
    els.timeoutSec.value = data.soraQueueTimeoutSec;
  }
  if (typeof data.soraQueueFileInfo === "string") {
    setFileInfo(data.soraQueueFileInfo);
  }
  updatePromptCount();
}

els.pickFileBtn.addEventListener("click", () => {
  els.fileInput.click();
});

els.clearBtn.addEventListener("click", async () => {
  els.prompts.value = "";
  setFileInfo("Файл не вибрано");
  updatePromptCount();
  await saveForm();
  await chrome.storage.local.set({ soraQueueFileInfo: "Файл не вибрано" });
});

els.fileInput.addEventListener("change", async (event) => {
  try {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const text = await file.text();
    els.prompts.value = text;
    const count = parsePrompts(text).length;
    setFileInfo(`Файл: ${file.name} | промптів: ${count}`);
    updatePromptCount();
    await saveForm();
    await chrome.storage.local.set({
      soraQueueFileInfo: `Файл: ${file.name} | промптів: ${count}`,
    });
    setStatus("Файл завантажено.");
  } catch (err) {
    setStatus(`Помилка читання файлу: ${String(err.message || err)}`);
  } finally {
    event.target.value = "";
  }
});

els.prompts.addEventListener("input", () => {
  updatePromptCount();
});

els.startBtn.addEventListener("click", async () => {
  try {
    const tab = await getActiveTab();
    if (!isSoraTab(tab)) {
      setStatus("Відкрий вкладку sora.chatgpt.com і повтори.");
      return;
    }

    const prompts = parsePrompts(els.prompts.value);
    if (!prompts.length) {
      setStatus("Додай хоча б один промпт.");
      return;
    }

    const delaySec = safeNumber(els.delaySec.value, 2, 0);
    const timeoutSec = safeNumber(els.timeoutSec.value, 90, 5);

    await saveForm();
    setStatus("Запускаю чергу...");

    await sendToTab(tab.id, {
      type: "soraQueue:start",
      prompts,
      delaySec,
      timeoutSec,
    });
  } catch (err) {
    setStatus(`Помилка запуску: ${String(err.message || err)}`);
  }
});

els.stopBtn.addEventListener("click", async () => {
  try {
    const tab = await getActiveTab();
    if (!isSoraTab(tab)) {
      setStatus("Відкрий вкладку sora.chatgpt.com і повтори.");
      return;
    }
    await sendToTab(tab.id, { type: "soraQueue:stop" });
    setStatus("Надіслано стоп.");
  } catch (err) {
    setStatus(`Помилка стопу: ${String(err.message || err)}`);
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (!message || typeof message !== "object") {
    return;
  }
  if (message.type === "soraQueue:status") {
    setStatus(message.text || "");
  }
});

restoreForm().catch((err) => {
  setStatus(`Не вдалося відновити дані: ${String(err.message || err)}`);
});
