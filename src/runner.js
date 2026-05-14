const els = {
  summary: document.querySelector("#summary"),
  stateBadge: document.querySelector("#stateBadge"),
  totalCount: document.querySelector("#totalCount"),
  processedCount: document.querySelector("#processedCount"),
  successCount: document.querySelector("#successCount"),
  failedCount: document.querySelector("#failedCount"),
  currentToken: document.querySelector("#currentToken"),
  startBtn: document.querySelector("#startBtn"),
  pauseBtn: document.querySelector("#pauseBtn"),
  stopBtn: document.querySelector("#stopBtn"),
  copyLogBtn: document.querySelector("#copyLogBtn"),
  logList: document.querySelector("#logList")
};

const state = {
  job: null,
  workTabId: null,
  running: false,
  paused: false,
  stopped: false,
  processed: 0,
  success: 0,
  failed: 0,
  logs: []
};

document.addEventListener("DOMContentLoaded", async () => {
  const stored = await chrome.storage.local.get({ blockJobDraft: null });
  state.job = normalizeJob(stored.blockJobDraft);
  bindEvents();
  render();
  if (!state.job.entries.length) {
    log("没有可执行的任务，请从扩展弹窗选择当前列表后打开执行页。");
    setBadge("error", "无任务");
  } else {
    log(`已加载任务：${state.job.sourceName}，${state.job.entries.length} 条${state.job.settings.dryRun ? "，试运行" : ""}`);
  }
});

function bindEvents() {
  els.startBtn.addEventListener("click", startJob);
  els.pauseBtn.addEventListener("click", togglePause);
  els.stopBtn.addEventListener("click", stopJob);
  els.copyLogBtn.addEventListener("click", copyLogs);
}

function normalizeJob(raw) {
  const settings = raw?.settings || {};
  const entries = Array.isArray(raw?.entries) ? raw.entries : [];
  return {
    sourceName: raw?.sourceName || "未命名列表",
    entries: entries.map((entry) => ({
      token: String(entry.token || "").trim(),
      note: String(entry.note || "").trim()
    })).filter((entry) => entry.token),
    settings: {
      dryRun: Boolean(settings.dryRun),
      minDelay: clamp(settings.minDelay, 1000, 60000, 3000),
      maxDelay: clamp(settings.maxDelay, clamp(settings.minDelay, 1000, 60000, 3000), 60000, 6000)
    }
  };
}

async function startJob() {
  if (state.running || !state.job.entries.length) {
    return;
  }

  state.running = true;
  state.paused = false;
  state.stopped = false;
  setBadge("running", "运行中");
  render();

  try {
    await ensureWorkTab();

    for (let index = state.processed; index < state.job.entries.length; index += 1) {
      if (state.stopped) {
        break;
      }

      await waitIfPaused();

      const entry = state.job.entries[index];
      els.currentToken.textContent = entry.token;
      log(`处理 ${index + 1}/${state.job.entries.length}：${entry.token}`);

      try {
        const result = await blockEntry(entry);
        state.success += result.ok ? 1 : 0;
        log(`${stateLabel(result.state)}：${entry.token}；${result.message || ""}`);
      } catch (error) {
        state.failed += 1;
        log(`失败：${entry.token}；${error.message}`);
      }

      state.processed += 1;
      render();

      if (state.processed < state.job.entries.length && !state.stopped) {
        await delay(randomBetween(state.job.settings.minDelay, state.job.settings.maxDelay));
      }
    }

    state.running = false;
    setBadge(state.stopped ? "idle" : "done", state.stopped ? "已停止" : "完成");
    log(state.stopped ? "任务已停止" : "任务完成");
  } catch (error) {
    state.running = false;
    state.failed += 1;
    setBadge("error", "异常");
    log(`任务异常：${error.message}`);
  } finally {
    render();
  }
}

async function blockEntry(entry) {
  const url = `https://www.zhihu.com/people/${encodeURIComponent(entry.token)}`;
  await chrome.tabs.update(state.workTabId, { url, active: false });
  await waitForTabLoaded(state.workTabId, url, 20000);

  await chrome.scripting.executeScript({
    target: { tabId: state.workTabId },
    files: ["src/blocker.js"]
  });

  const response = await sendTabMessage(state.workTabId, {
    type: "blockCurrentProfile",
    payload: {
      token: entry.token,
      dryRun: state.job.settings.dryRun
    }
  });

  if (!response?.ok) {
    throw new Error(response?.error || "页面脚本执行失败");
  }

  return response;
}

async function ensureWorkTab() {
  if (state.workTabId) {
    try {
      await chrome.tabs.get(state.workTabId);
      return;
    } catch (error) {
      state.workTabId = null;
    }
  }

  const tab = await chrome.tabs.create({
    url: "https://www.zhihu.com/",
    active: false
  });
  state.workTabId = tab.id;
  log("已创建知乎工作标签页");
}

function waitForTabLoaded(tabId, expectedUrl, timeout) {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const timer = setInterval(async () => {
      try {
        const tab = await chrome.tabs.get(tabId);
        const loaded = tab.status === "complete";
        const matched = !expectedUrl || (tab.url || "").startsWith(expectedUrl);
        if (loaded && matched) {
          clearInterval(timer);
          resolve(tab);
          return;
        }

        if (Date.now() - start >= timeout) {
          clearInterval(timer);
          reject(new Error("页面加载超时"));
        }
      } catch (error) {
        clearInterval(timer);
        reject(error);
      }
    }, 250);
  });
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(response);
    });
  });
}

function togglePause() {
  if (!state.running) {
    return;
  }

  state.paused = !state.paused;
  log(state.paused ? "已暂停" : "继续执行");
  setBadge(state.paused ? "idle" : "running", state.paused ? "已暂停" : "运行中");
  render();
}

function stopJob() {
  state.stopped = true;
  state.paused = false;
  log("正在停止任务");
  render();
}

async function waitIfPaused() {
  while (state.paused && !state.stopped) {
    await delay(300);
  }
}

async function copyLogs() {
  await navigator.clipboard.writeText(state.logs.join("\n"));
}

function render() {
  const total = state.job?.entries.length || 0;
  els.summary.textContent = state.job
    ? `${state.job.sourceName}；${total} 条；间隔 ${state.job.settings.minDelay}-${state.job.settings.maxDelay}ms${state.job.settings.dryRun ? "；试运行" : ""}`
    : "等待任务";
  els.totalCount.textContent = String(total);
  els.processedCount.textContent = String(state.processed);
  els.successCount.textContent = String(state.success);
  els.failedCount.textContent = String(state.failed);
  els.startBtn.disabled = state.running || total === 0;
  els.pauseBtn.disabled = !state.running;
  els.pauseBtn.textContent = state.paused ? "继续" : "暂停";
  els.stopBtn.disabled = !state.running;
  renderLogs();
}

function renderLogs() {
  els.logList.replaceChildren(
    ...state.logs.slice(-300).map((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      return li;
    })
  );
  els.logList.scrollTop = els.logList.scrollHeight;
}

function setBadge(type, text) {
  els.stateBadge.className = `badge ${type}`;
  els.stateBadge.textContent = text;
}

function log(message) {
  const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  state.logs.push(`[${time}] ${message}`);
  renderLogs();
}

function stateLabel(value) {
  return {
    blocked: "已屏蔽",
    "already-blocked": "已是屏蔽状态",
    "dry-run": "试运行"
  }[value] || value || "完成";
}

function clamp(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function randomBetween(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
