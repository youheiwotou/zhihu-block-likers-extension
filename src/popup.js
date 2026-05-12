const DEFAULT_SETTINGS = {
  maxUsers: 50,
  minDelay: 1600,
  maxDelay: 3200,
  dryRun: false
};

const els = {
  pageStatus: document.querySelector("#pageStatus"),
  stateBadge: document.querySelector("#stateBadge"),
  maxUsers: document.querySelector("#maxUsers"),
  minDelay: document.querySelector("#minDelay"),
  maxDelay: document.querySelector("#maxDelay"),
  dryRun: document.querySelector("#dryRun"),
  foundCount: document.querySelector("#foundCount"),
  processedCount: document.querySelector("#processedCount"),
  failedCount: document.querySelector("#failedCount"),
  openListBtn: document.querySelector("#openListBtn"),
  startBtn: document.querySelector("#startBtn"),
  pauseBtn: document.querySelector("#pauseBtn"),
  stopBtn: document.querySelector("#stopBtn"),
  copyLogBtn: document.querySelector("#copyLogBtn"),
  logList: document.querySelector("#logList")
};

let activeTabId = null;
let lastStatus = null;

document.addEventListener("DOMContentLoaded", async () => {
  await restoreSettings();
  await detectActiveTab();
  bindEvents();
  await refreshStatus();
  setInterval(refreshStatus, 1000);
});

function bindEvents() {
  for (const input of [els.maxUsers, els.minDelay, els.maxDelay, els.dryRun]) {
    input.addEventListener("change", persistSettings);
  }

  els.openListBtn.addEventListener("click", () => sendCommand("openLikerList"));
  els.startBtn.addEventListener("click", () => sendCommand("start", readSettings()));
  els.pauseBtn.addEventListener("click", () => {
    const command = lastStatus?.state === "paused" ? "resume" : "pause";
    sendCommand(command);
  });
  els.stopBtn.addEventListener("click", () => sendCommand("stop"));
  els.copyLogBtn.addEventListener("click", copyLogs);
}

async function restoreSettings() {
  const stored = await chrome.storage.local.get(DEFAULT_SETTINGS);
  els.maxUsers.value = stored.maxUsers;
  els.minDelay.value = stored.minDelay;
  els.maxDelay.value = stored.maxDelay;
  els.dryRun.checked = Boolean(stored.dryRun);
}

async function persistSettings() {
  await chrome.storage.local.set(readSettings());
}

function readSettings() {
  const maxUsers = clampNumber(els.maxUsers.value, 1, 1000, DEFAULT_SETTINGS.maxUsers);
  const minDelay = clampNumber(els.minDelay.value, 500, 60000, DEFAULT_SETTINGS.minDelay);
  const maxDelay = clampNumber(els.maxDelay.value, minDelay, 60000, Math.max(minDelay, DEFAULT_SETTINGS.maxDelay));

  els.maxUsers.value = maxUsers;
  els.minDelay.value = minDelay;
  els.maxDelay.value = maxDelay;

  return {
    maxUsers,
    minDelay,
    maxDelay,
    dryRun: els.dryRun.checked
  };
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

async function detectActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTabId = tab?.id ?? null;

  if (!tab?.url?.startsWith("https://www.zhihu.com/")) {
    els.pageStatus.textContent = "请切换到知乎网页";
    setControlsEnabled(false);
    return;
  }

  els.pageStatus.textContent = "已连接知乎页面";
  setControlsEnabled(true);
}

async function refreshStatus() {
  if (!activeTabId) {
    return;
  }

  try {
    const status = await sendMessage({ type: "getStatus" }, false);
    if (status) {
      renderStatus(status);
    }
  } catch (error) {
    renderUnavailable(error);
  }
}

async function sendCommand(command, payload = {}) {
  await persistSettings();
  try {
    const response = await sendMessage({ type: command, payload });
    if (response) {
      renderStatus(response);
    }
  } catch (error) {
    renderUnavailable(error);
  }
}

function sendMessage(message, showError = true) {
  return sendMessageWithRetry(message, showError);
}

async function sendMessageWithRetry(message, showError) {
  const first = await rawSendMessage(message);
  if (!first.error) {
    return first.response;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: activeTabId },
      files: ["src/content.js"]
    });
  } catch (error) {
    if (showError) {
      throw error;
    }
    return null;
  }

  const second = await rawSendMessage(message);
  if (!second.error) {
    return second.response;
  }

  if (showError) {
    throw second.error;
  }
  return null;
}

function rawSendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(activeTabId, message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        resolve({ error: new Error(error.message) });
        return;
      }
      resolve({ response });
    });
  });
}

function renderStatus(status) {
  lastStatus = status;
  els.pageStatus.textContent = status.pageMessage || "已连接知乎页面";
  els.foundCount.textContent = status.found;
  els.processedCount.textContent = status.processed;
  els.failedCount.textContent = status.failed;

  els.stateBadge.className = `badge ${status.state}`;
  els.stateBadge.textContent = stateText(status.state);
  els.pauseBtn.textContent = status.state === "paused" ? "继续" : "暂停";

  els.openListBtn.disabled = status.state === "running";
  els.startBtn.disabled = status.state === "running";
  els.pauseBtn.disabled = !["running", "paused"].includes(status.state);
  els.stopBtn.disabled = !["running", "paused"].includes(status.state);

  renderLogs(status.logs || []);
}

function stateText(state) {
  return {
    idle: "空闲",
    running: "运行中",
    paused: "已暂停",
    stopped: "已停止",
    done: "完成",
    error: "异常"
  }[state] || state;
}

function renderLogs(logs) {
  els.logList.replaceChildren(
    ...logs.slice(-80).map((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      return li;
    })
  );
  els.logList.scrollTop = els.logList.scrollHeight;
}

function setControlsEnabled(enabled) {
  for (const button of [els.openListBtn, els.startBtn, els.pauseBtn, els.stopBtn, els.copyLogBtn]) {
    button.disabled = !enabled;
  }
}

function renderUnavailable(error) {
  els.pageStatus.textContent = "请刷新知乎页面后重试";
  els.stateBadge.className = "badge error";
  els.stateBadge.textContent = "未注入";
  renderLogs([error?.message || "内容脚本未响应"]);
}

async function copyLogs() {
  const logs = Array.from(els.logList.querySelectorAll("li")).map((li) => li.textContent).join("\n");
  await navigator.clipboard.writeText(logs);
}
