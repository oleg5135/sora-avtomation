const soraQueueState = {
  running: false,
  stopRequested: false,
};

const TEXTAREA_SELECTORS = [
  "textarea[placeholder='Describe your image...']",
  "textarea[placeholder='Describe your video...']",
  "div.pointer-events-auto textarea",
  "textarea",
];

const SUBMIT_BUTTON_XPATHS = [
  "//button[.//span[contains(@class,'sr-only') and normalize-space()='Create image']]",
  "//button[.//span[contains(@class,'sr-only') and normalize-space()='Create video']]",
  "//button[.//span[contains(@class,'sr-only') and contains(normalize-space(), 'Create')]]",
];

function sendStatus(text) {
  chrome.runtime.sendMessage({
    type: "soraQueue:status",
    text,
  }).catch(() => {
    // Popup can be closed; ignore.
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isUnavailablePage() {
  const text = (document.body?.innerText || "").toLowerCase();
  return text.includes("sora is not available right now");
}

function findTextarea() {
  for (const selector of TEXTAREA_SELECTORS) {
    const nodes = Array.from(document.querySelectorAll(selector));
    for (const node of nodes) {
      if (!(node instanceof HTMLTextAreaElement)) {
        continue;
      }
      if (!node.offsetParent && node.getClientRects().length === 0) {
        continue;
      }
      const ph = (node.getAttribute("placeholder") || "").toLowerCase();
      if (!ph || ph.includes("describe your")) {
        return node;
      }
    }
  }
  return null;
}

function findSubmitButton() {
  for (const xpath of SUBMIT_BUTTON_XPATHS) {
    const result = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    const node = result.singleNodeValue;
    if (node instanceof HTMLButtonElement) {
      return node;
    }
  }
  return null;
}

function isButtonReady(button) {
  if (!button) {
    return false;
  }
  if (button.disabled) {
    return false;
  }
  const dataDisabled = button.getAttribute("data-disabled");
  return dataDisabled !== "true";
}

async function waitForElement(getter, timeoutSec, stopCheck) {
  const deadline = Date.now() + timeoutSec * 1000;
  while (Date.now() < deadline) {
    if (stopCheck()) {
      throw new Error("Зупинено.");
    }
    const element = getter();
    if (element) {
      return element;
    }
    await sleep(200);
  }
  return null;
}

function setNativeValue(element, value) {
  const proto = Object.getPrototypeOf(element);
  const valueSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (valueSetter) {
    valueSetter.call(element, value);
  } else {
    element.value = value;
  }
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

async function runQueue(prompts, delaySec, timeoutSec) {
  if (soraQueueState.running) {
    sendStatus("Черга вже працює.");
    return;
  }

  soraQueueState.running = true;
  soraQueueState.stopRequested = false;

  try {
    if (isUnavailablePage()) {
      sendStatus("Sora зараз недоступна для цього акаунта/регіону.");
      return;
    }

    sendStatus(`Починаю чергу: ${prompts.length} промптів.`);

    for (let i = 0; i < prompts.length; i += 1) {
      if (soraQueueState.stopRequested) {
        sendStatus("Зупинено користувачем.");
        return;
      }

      const prompt = prompts[i];

      const textarea = await waitForElement(
        findTextarea,
        timeoutSec,
        () => soraQueueState.stopRequested
      );
      if (!textarea) {
        sendStatus(`Таймаут: не знайдено поле вводу (крок ${i + 1}).`);
        return;
      }

      textarea.focus();
      setNativeValue(textarea, prompt);

      const submitBtn = await waitForElement(
        () => {
          const btn = findSubmitButton();
          return isButtonReady(btn) ? btn : null;
        },
        timeoutSec,
        () => soraQueueState.stopRequested
      );
      if (!submitBtn) {
        sendStatus(`Таймаут: кнопка Create недоступна (крок ${i + 1}).`);
        return;
      }

      submitBtn.click();
      sendStatus(`[${i + 1}/${prompts.length}] Надіслано.`);

      if (i < prompts.length - 1) {
        const delayMs = Math.max(0, Number(delaySec) * 1000);
        const step = 100;
        let waited = 0;
        while (waited < delayMs) {
          if (soraQueueState.stopRequested) {
            sendStatus("Зупинено користувачем.");
            return;
          }
          await sleep(step);
          waited += step;
        }
      }
    }

    sendStatus("Черга завершена.");
  } catch (err) {
    sendStatus(`Помилка: ${String(err.message || err)}`);
  } finally {
    soraQueueState.running = false;
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (!message || typeof message !== "object") {
    return;
  }

  if (message.type === "soraQueue:start") {
    const prompts = Array.isArray(message.prompts) ? message.prompts : [];
    const delaySec = Number(message.delaySec) || 2;
    const timeoutSec = Number(message.timeoutSec) || 90;
    runQueue(prompts, delaySec, timeoutSec);
  }

  if (message.type === "soraQueue:stop") {
    soraQueueState.stopRequested = true;
  }
});
