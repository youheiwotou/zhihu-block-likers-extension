const DEFAULT_STATE = {
  repository: "",
  branch: "main",
  indexPath: "index.json",
  selectedListId: "",
  indexCache: null,
  listCache: {},
  exportCache: null,
  blockMaxUsers: 20,
  blockMinDelay: 3000,
  blockMaxDelay: 7000,
  blockDryRun: true,
  lastSyncAt: ""
};

const MAX_RENDERED_ENTRIES = 300;

const els = {
  syncStatus: document.querySelector("#syncStatus"),
  stateBadge: document.querySelector("#stateBadge"),
  repository: document.querySelector("#repository"),
  branch: document.querySelector("#branch"),
  indexPath: document.querySelector("#indexPath"),
  syncAllBtn: document.querySelector("#syncAllBtn"),
  syncIndexBtn: document.querySelector("#syncIndexBtn"),
  copyListBtn: document.querySelector("#copyListBtn"),
  clearCacheBtn: document.querySelector("#clearCacheBtn"),
  exportBlacklistBtn: document.querySelector("#exportBlacklistBtn"),
  copyExportBtn: document.querySelector("#copyExportBtn"),
  exportCount: document.querySelector("#exportCount"),
  exportMeta: document.querySelector("#exportMeta"),
  blockPlanCount: document.querySelector("#blockPlanCount"),
  blockMaxUsers: document.querySelector("#blockMaxUsers"),
  blockMinDelay: document.querySelector("#blockMinDelay"),
  blockMaxDelay: document.querySelector("#blockMaxDelay"),
  blockDryRun: document.querySelector("#blockDryRun"),
  blockConfirm: document.querySelector("#blockConfirm"),
  openRunnerBtn: document.querySelector("#openRunnerBtn"),
  listCount: document.querySelector("#listCount"),
  entryCount: document.querySelector("#entryCount"),
  updatedAt: document.querySelector("#updatedAt"),
  listSelect: document.querySelector("#listSelect"),
  filterInput: document.querySelector("#filterInput"),
  listMeta: document.querySelector("#listMeta"),
  visibleCount: document.querySelector("#visibleCount"),
  entryList: document.querySelector("#entryList"),
  copyLogBtn: document.querySelector("#copyLogBtn"),
  logList: document.querySelector("#logList")
};

let appState = { ...DEFAULT_STATE };
let logs = [];
let busy = false;

document.addEventListener("DOMContentLoaded", async () => {
  appState = await loadState();
  hydrateForm();
  bindEvents();
  render();
});

function bindEvents() {
  for (const input of [els.repository, els.branch, els.indexPath]) {
    input.addEventListener("change", persistConfigFromForm);
  }
  for (const input of [els.blockMaxUsers, els.blockMinDelay, els.blockMaxDelay, els.blockDryRun]) {
    input.addEventListener("change", persistBlockSettingsFromForm);
  }

  els.syncAllBtn.addEventListener("click", syncAllLists);
  els.syncIndexBtn.addEventListener("click", syncIndexOnly);
  els.copyListBtn.addEventListener("click", copyCurrentList);
  els.clearCacheBtn.addEventListener("click", clearCache);
  els.exportBlacklistBtn.addEventListener("click", exportOwnBlacklist);
  els.copyExportBtn.addEventListener("click", copyExportedBlacklist);
  els.openRunnerBtn.addEventListener("click", openBlockRunner);
  els.copyLogBtn.addEventListener("click", copyLogs);

  els.listSelect.addEventListener("change", async () => {
    appState.selectedListId = els.listSelect.value;
    await saveState();
    render();
  });

  els.filterInput.addEventListener("input", renderEntries);
}

async function loadState() {
  const stored = await chrome.storage.local.get(DEFAULT_STATE);
  return {
    ...DEFAULT_STATE,
    ...stored,
    listCache: stored.listCache && typeof stored.listCache === "object" ? stored.listCache : {}
  };
}

async function saveState() {
  await chrome.storage.local.set({
    repository: appState.repository,
    branch: appState.branch,
    indexPath: appState.indexPath,
    selectedListId: appState.selectedListId,
    indexCache: appState.indexCache,
    listCache: appState.listCache,
    exportCache: appState.exportCache,
    blockMaxUsers: appState.blockMaxUsers,
    blockMinDelay: appState.blockMinDelay,
    blockMaxDelay: appState.blockMaxDelay,
    blockDryRun: appState.blockDryRun,
    lastSyncAt: appState.lastSyncAt
  });
}

function hydrateForm() {
  els.repository.value = appState.repository || "";
  els.branch.value = appState.branch || "main";
  els.indexPath.value = appState.indexPath || "index.json";
  els.blockMaxUsers.value = appState.blockMaxUsers || 20;
  els.blockMinDelay.value = appState.blockMinDelay || 3000;
  els.blockMaxDelay.value = appState.blockMaxDelay || 7000;
  els.blockDryRun.checked = appState.blockDryRun !== false;
}

async function persistConfigFromForm() {
  try {
    const config = readConfig();
    appState.repository = config.repository;
    appState.branch = config.branch;
    appState.indexPath = config.indexPath;
    await saveState();
    render();
  } catch (error) {
    setStatus("error", error.message);
  }
}

function readConfig() {
  const repository = normalizeRepository(els.repository.value);
  const branch = normalizeBranch(els.branch.value);
  const indexPath = normalizeRepoPath(els.indexPath.value, "目录文件");

  return {
    repository,
    branch,
    indexPath
  };
}

async function persistBlockSettingsFromForm() {
  const settings = readBlockSettings();
  appState.blockMaxUsers = settings.maxUsers;
  appState.blockMinDelay = settings.minDelay;
  appState.blockMaxDelay = settings.maxDelay;
  appState.blockDryRun = settings.dryRun;
  await saveState();
  renderBlockPlan();
}

function readBlockSettings() {
  const maxUsers = clampNumber(els.blockMaxUsers.value, 1, 500, 20);
  const minDelay = clampNumber(els.blockMinDelay.value, 1000, 60000, 3000);
  const maxDelay = clampNumber(els.blockMaxDelay.value, minDelay, 60000, 7000);

  els.blockMaxUsers.value = maxUsers;
  els.blockMinDelay.value = minDelay;
  els.blockMaxDelay.value = maxDelay;

  return {
    maxUsers,
    minDelay,
    maxDelay,
    dryRun: els.blockDryRun.checked
  };
}

async function syncIndexOnly() {
  await runTask(async () => {
    const config = readConfig();
    storeConfig(config);
    log(`同步目录：${config.repository}@${config.branch}/${config.indexPath}`);

    appState.indexCache = await fetchIndex(config);
    appState.listCache = keepCacheForLists(appState.listCache, appState.indexCache.lists);
    ensureSelectedList();
    appState.lastSyncAt = appState.indexCache.fetchedAt;
    await saveState();

    log(`目录已同步：${appState.indexCache.lists.length} 个列表`);
    setStatus("ready", "目录已同步");
  });
}

async function syncAllLists() {
  await runTask(async () => {
    const config = readConfig();
    storeConfig(config);
    log(`同步目录：${config.repository}@${config.branch}/${config.indexPath}`);

    const indexCache = await fetchIndex(config);
    const nextCache = keepCacheForLists(appState.listCache, indexCache.lists);
    let synced = 0;
    let failed = 0;

    appState.indexCache = indexCache;
    ensureSelectedList();
    render();

    for (const list of indexCache.lists) {
      try {
        const syncedList = await fetchList(config, list);
        nextCache[list.id] = syncedList;
        synced += 1;
        log(`已同步：${list.name}（${syncedList.entries.length} 条）`);
      } catch (error) {
        failed += 1;
        log(`失败：${list.name} - ${error.message}`);
      }
    }

    appState.listCache = nextCache;
    appState.lastSyncAt = new Date().toISOString();
    await saveState();

    if (failed > 0) {
      setStatus("error", `已同步 ${synced} 个，失败 ${failed} 个`);
    } else {
      setStatus("ready", `已同步 ${synced} 个列表`);
    }
  });
}

async function runTask(task) {
  if (busy) {
    return;
  }

  busy = true;
  setStatus("working", "同步中");
  setControlsEnabled(false);

  try {
    await task();
  } catch (error) {
    log(`错误：${error.message}`);
    setStatus("error", error.message);
  } finally {
    busy = false;
    setControlsEnabled(true);
    render();
  }
}

async function exportOwnBlacklist() {
  await runTask(async () => {
    const tab = await getActiveZhihuTab();
    log("开始采集当前知乎页黑名单");

    await injectExporter(tab.id);
    const response = await sendTabMessage(tab.id, {
      type: "exportOwnBlacklist",
      payload: {
        maxPages: 500
      }
    });

    if (!response?.ok) {
      throw new Error(response?.error || "采集失败");
    }

    appState.exportCache = {
      entries: response.entries,
      fetchedAt: new Date().toISOString(),
      pages: response.pages,
      total: response.total || 0,
      reason: response.reason,
      sourceUrl: tab.url || ""
    };
    await saveState();

    for (const item of response.logs || []) {
      log(item);
    }
    log(`导出完成：${response.entries.length} 条，${response.pages} 页`);
    setStatus("ready", `已导出 ${response.entries.length} 条`);
  });
}

async function getActiveZhihuTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error("没有找到当前标签页");
  }

  if (!/^https:\/\/(?:www\.)?zhihu\.com\//i.test(tab.url || "")) {
    throw new Error("请先打开 https://www.zhihu.com/settings/filter");
  }

  return tab;
}

async function injectExporter(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["src/exporter.js"]
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

function storeConfig(config) {
  appState.repository = config.repository;
  appState.branch = config.branch;
  appState.indexPath = config.indexPath;
}

async function fetchIndex(config) {
  const sourceUrl = rawUrlFor(config, config.indexPath);
  const text = await fetchText(sourceUrl);
  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error("目录文件必须是 JSON");
  }

  const sourceLists = Array.isArray(parsed) ? parsed : parsed.lists;
  if (!Array.isArray(sourceLists)) {
    throw new Error("目录文件需要包含 lists 数组");
  }

  const usedIds = new Set();
  const lists = sourceLists.map((item, index) => normalizeListMeta(item, index, usedIds));
  if (lists.length === 0) {
    throw new Error("目录文件没有可同步的列表");
  }

  return {
    version: parsed.version || 1,
    sourceUrl,
    fetchedAt: new Date().toISOString(),
    lists
  };
}

function normalizeListMeta(item, index, usedIds) {
  if (!item || typeof item !== "object") {
    throw new Error(`第 ${index + 1} 个列表配置不是对象`);
  }

  const path = normalizeRepoPath(item.path || item.file || item.url, `第 ${index + 1} 个列表路径`);
  const baseId = normalizeListId(item.id || item.name || basename(path) || `list-${index + 1}`);
  let id = baseId;
  let suffix = 2;

  while (usedIds.has(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(id);

  return {
    id,
    name: String(item.name || id).trim(),
    path,
    description: String(item.description || item.note || "").trim()
  };
}

async function fetchList(config, list) {
  const sourceUrl = rawUrlFor(config, list.path);
  const text = await fetchText(sourceUrl);
  const entries = parseListEntries(text, list.path);

  return {
    ...list,
    sourceUrl,
    fetchedAt: new Date().toISOString(),
    entries
  };
}

async function fetchText(url) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json,text/plain;q=0.9,*/*;q=0.8"
    }
  });

  if (!response.ok) {
    throw new Error(`请求失败 ${response.status}`);
  }

  return response.text();
}

function parseListEntries(text, path) {
  const trimmed = text.trim();
  const jsonLike = path.toLowerCase().endsWith(".json") || trimmed.startsWith("{") || trimmed.startsWith("[");

  if (jsonLike) {
    try {
      return dedupeEntries(parseJsonEntries(JSON.parse(trimmed)));
    } catch (error) {
      throw new Error("列表 JSON 解析失败");
    }
  }

  return dedupeEntries(parseTextEntries(text));
}

function parseJsonEntries(parsed) {
  const source = Array.isArray(parsed)
    ? parsed
    : parsed.users || parsed.items || parsed.entries || parsed.blacklist || [];

  if (!Array.isArray(source)) {
    throw new Error("JSON 列表需要是数组，或包含 users/items/entries/blacklist 数组");
  }

  return source.map((item, index) => {
    if (typeof item === "string") {
      return entryFromValue(item, "", index + 1);
    }

    if (item && typeof item === "object") {
      const value = item.token || item.id || item.url || item.profile || item.homepage || item.href || "";
      const note = item.note || item.reason || item.name || item.description || "";
      return entryFromValue(value, note, index + 1);
    }

    return null;
  }).filter(Boolean);
}

function parseTextEntries(text) {
  return text.split(/\r?\n/).map((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return null;
    }

    const match = trimmed.match(/^([^,\s]+)[,\s]*(.*)$/);
    if (!match) {
      return null;
    }

    return entryFromValue(match[1], match[2] || "", index + 1, trimmed);
  }).filter(Boolean);
}

function entryFromValue(value, note, line, sourceLine = "") {
  const token = normalizeZhihuToken(value);
  if (!token) {
    return null;
  }

  return {
    token,
    note: String(note || "").trim(),
    line,
    sourceLine: sourceLine || String(value || "").trim()
  };
}

function dedupeEntries(entries) {
  const seen = new Set();
  const result = [];

  for (const entry of entries) {
    const key = entry.token.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(entry);
  }

  return result;
}

function normalizeZhihuToken(value) {
  let clean = String(value || "").trim();
  if (!clean) {
    return "";
  }

  const profileMatch = clean.match(/(?:https?:\/\/(?:www\.)?zhihu\.com)?\/people\/([^/?#\s,]+)/i);
  if (profileMatch) {
    clean = profileMatch[1];
  } else {
    clean = clean.replace(/^@+/, "");
    clean = clean.replace(/^https?:\/\/(?:www\.)?zhihu\.com\/people\//i, "");
    clean = clean.split(/[?#]/)[0].replace(/\/+$/, "");
  }

  try {
    clean = decodeURIComponent(clean);
  } catch (error) {
    return "";
  }

  return clean.trim();
}

function normalizeRepository(value) {
  const input = String(value || "").trim().replace(/\.git$/i, "");
  if (!input) {
    throw new Error("请填写 GitHub 仓库");
  }

  const direct = input.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (direct) {
    return `${direct[1]}/${direct[2]}`;
  }

  const urlMatch = input.match(/^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\/.*)?$/i);
  if (urlMatch) {
    return `${urlMatch[1]}/${urlMatch[2]}`;
  }

  throw new Error("仓库格式应为 owner/repo 或 GitHub 仓库 URL");
}

function normalizeBranch(value) {
  const branch = String(value || "").trim();
  if (!branch) {
    throw new Error("请填写分支");
  }
  if (/^\//.test(branch) || branch.includes("..")) {
    throw new Error("分支名称不合法");
  }
  return branch;
}

function normalizeRepoPath(value, label) {
  const path = String(value || "").trim().replace(/^\/+/, "");
  if (!path) {
    throw new Error(`${label}不能为空`);
  }
  if (/^https?:\/\//i.test(path) || path.split("/").includes("..")) {
    throw new Error(`${label}必须是仓库内相对路径`);
  }
  return path;
}

function normalizeListId(value) {
  const id = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return id || "list";
}

function rawUrlFor(config, path) {
  const [owner, repo] = config.repository.split("/");
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const encodedBranch = config.branch.split("/").map(encodeURIComponent).join("/");
  return `https://raw.githubusercontent.com/${owner}/${repo}/${encodedBranch}/${encodedPath}`;
}

function basename(path) {
  return String(path || "").split("/").filter(Boolean).pop() || "";
}

function ensureSelectedList() {
  const lists = appState.indexCache?.lists || [];
  if (lists.length === 0) {
    appState.selectedListId = "";
    return;
  }

  if (!lists.some((list) => list.id === appState.selectedListId)) {
    appState.selectedListId = lists[0].id;
  }
}

function keepCacheForLists(cache, lists) {
  const allowed = new Set(lists.map((list) => list.id));
  return Object.fromEntries(
    Object.entries(cache || {}).filter(([id]) => allowed.has(id))
  );
}

async function copyCurrentList() {
  const list = getSelectedCachedList();
  if (!list) {
    setStatus("error", "当前列表尚未同步");
    return;
  }

  await navigator.clipboard.writeText(list.entries.map((entry) => entry.token).join("\n"));
  log(`已复制当前列表：${list.name}`);
  setStatus("ready", "已复制");
}

async function copyExportedBlacklist() {
  const entries = appState.exportCache?.entries || [];
  if (entries.length === 0) {
    setStatus("error", "没有可复制的导出结果");
    return;
  }

  await navigator.clipboard.writeText(entries.map((entry) => entry.token).join("\n"));
  log(`已复制导出结果：${entries.length} 条`);
  setStatus("ready", "导出结果已复制");
}

async function openBlockRunner() {
  const list = getSelectedCachedList();
  if (!list || list.entries.length === 0) {
    setStatus("error", "当前列表尚未同步");
    return;
  }

  const settings = readBlockSettings();
  await persistBlockSettingsFromForm();

  if (!settings.dryRun && !els.blockConfirm.checked) {
    setStatus("error", "实际屏蔽前需要先勾选确认");
    log("实际屏蔽前需要先勾选确认。");
    return;
  }

  const entries = list.entries.slice(0, settings.maxUsers).map((entry) => ({
    token: entry.token,
    note: entry.note || ""
  }));

  await chrome.storage.local.set({
    blockJobDraft: {
      createdAt: new Date().toISOString(),
      sourceName: list.name,
      entries,
      settings
    }
  });

  await chrome.tabs.create({
    url: chrome.runtime.getURL("src/runner.html")
  });

  log(`已创建执行任务：${list.name}，${entries.length} 条${settings.dryRun ? "，试运行" : ""}`);
  setStatus("ready", "已打开执行页");
}

async function clearCache() {
  const confirmed = window.confirm("清空本地缓存的目录、列表和导出结果？仓库配置会保留。");
  if (!confirmed) {
    return;
  }

  appState.indexCache = null;
  appState.listCache = {};
  appState.exportCache = null;
  appState.selectedListId = "";
  appState.lastSyncAt = "";
  await saveState();
  log("已清空本地缓存");
  setStatus("idle", "缓存已清空");
  render();
}

async function copyLogs() {
  await navigator.clipboard.writeText(logs.join("\n"));
  setStatus("ready", "日志已复制");
}

function render() {
  hydrateForm();
  renderSummary();
  renderExportSummary();
  renderBlockPlan();
  renderListSelect();
  renderSelectedMeta();
  renderEntries();
  renderLogs();
  updateEmptyStatus();
}

function renderBlockPlan() {
  const list = getSelectedCachedList();
  const maxUsers = clampNumber(els.blockMaxUsers.value, 1, 500, appState.blockMaxUsers || 20);
  const count = list ? Math.min(maxUsers, list.entries.length) : 0;
  els.blockPlanCount.textContent = String(count);
  els.openRunnerBtn.disabled = busy || count === 0;
}

function renderExportSummary() {
  const entries = appState.exportCache?.entries || [];
  els.exportCount.textContent = String(entries.length);
  els.copyExportBtn.disabled = busy || entries.length === 0;

  if (entries.length === 0) {
    els.exportMeta.textContent = "尚未导出";
    return;
  }

  const pages = appState.exportCache.pages || 1;
  const total = appState.exportCache.total ? ` / 共 ${appState.exportCache.total} 条` : "";
  const updated = formatTime(appState.exportCache.fetchedAt);
  const reason = appState.exportCache.reason ? `；${appState.exportCache.reason}` : "";
  els.exportMeta.textContent = `${entries.length} 条${total}；${pages} 页；更新 ${updated}${reason}`;
}

function renderSummary() {
  const lists = appState.indexCache?.lists || [];
  const currentIds = new Set(lists.map((list) => list.id));
  const totalEntries = Object.entries(appState.listCache || {})
    .filter(([id]) => currentIds.has(id))
    .reduce((sum, [, list]) => sum + (Array.isArray(list.entries) ? list.entries.length : 0), 0);

  els.listCount.textContent = String(lists.length);
  els.entryCount.textContent = String(totalEntries);
  els.updatedAt.textContent = formatTime(appState.lastSyncAt || appState.indexCache?.fetchedAt);
}

function renderListSelect() {
  const lists = appState.indexCache?.lists || [];
  els.listSelect.replaceChildren(
    ...lists.map((list) => {
      const option = document.createElement("option");
      option.value = list.id;
      option.textContent = `${list.name}${appState.listCache[list.id] ? "" : "（未同步）"}`;
      return option;
    })
  );

  els.listSelect.disabled = lists.length === 0;
  els.listSelect.value = appState.selectedListId || "";
}

function renderSelectedMeta() {
  const meta = getSelectedMeta();
  const cached = getSelectedCachedList();

  if (!meta) {
    els.listMeta.textContent = "尚未同步目录";
    return;
  }

  const entryText = cached ? `${cached.entries.length} 条` : "未同步";
  const updatedText = cached ? formatTime(cached.fetchedAt) : "-";
  const description = meta.description ? `；${meta.description}` : "";
  els.listMeta.textContent = `${meta.name}；${entryText}；${meta.path}；更新 ${updatedText}${description}`;
}

function renderEntries() {
  const list = getSelectedCachedList();
  const query = els.filterInput.value.trim().toLowerCase();

  if (!list) {
    els.entryList.replaceChildren(emptyItem("当前列表尚未同步"));
    els.visibleCount.textContent = "0";
    return;
  }

  const filtered = list.entries.filter((entry) => {
    if (!query) {
      return true;
    }
    return [entry.token, entry.note, entry.sourceLine].some((value) => String(value || "").toLowerCase().includes(query));
  });

  const visible = filtered.slice(0, MAX_RENDERED_ENTRIES);
  const nodes = visible.map(renderEntryItem);
  if (filtered.length > MAX_RENDERED_ENTRIES) {
    nodes.push(emptyItem(`还有 ${filtered.length - MAX_RENDERED_ENTRIES} 条未显示，请用搜索缩小范围`));
  }

  els.entryList.replaceChildren(...nodes);
  els.visibleCount.textContent = `${filtered.length}/${list.entries.length}`;
}

function renderEntryItem(entry) {
  const li = document.createElement("li");
  const token = document.createElement("span");
  token.className = "entryToken";
  token.textContent = entry.token;
  li.append(token);

  const details = [entry.note, entry.sourceLine && entry.sourceLine !== entry.token ? entry.sourceLine : ""]
    .filter(Boolean)
    .join(" / ");
  if (details) {
    const note = document.createElement("span");
    note.className = "entryNote";
    note.textContent = details;
    li.append(note);
  }

  return li;
}

function renderLogs() {
  els.logList.replaceChildren(
    ...logs.slice(-80).map((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      return li;
    })
  );
  els.logList.scrollTop = els.logList.scrollHeight;
}

function updateEmptyStatus() {
  if (busy) {
    return;
  }
  if (!appState.repository) {
    setStatus("idle", "配置 GitHub 仓库后同步列表");
    return;
  }
  if (!appState.indexCache) {
    setStatus("idle", "尚未同步");
    return;
  }
  if (!els.syncStatus.textContent || els.syncStatus.textContent === "配置 GitHub 仓库后同步列表") {
    setStatus("ready", "已加载本地缓存");
  }
}

function setStatus(type, message) {
  els.stateBadge.className = `badge ${type}`;
  els.stateBadge.textContent = {
    idle: "未同步",
    working: "同步中",
    ready: "已同步",
    error: "错误"
  }[type] || type;
  els.syncStatus.textContent = message;
}

function setControlsEnabled(enabled) {
  for (const button of [els.syncAllBtn, els.syncIndexBtn, els.copyListBtn, els.clearCacheBtn]) {
    button.disabled = !enabled;
  }
  els.exportBlacklistBtn.disabled = !enabled;
  els.copyExportBtn.disabled = !enabled || !(appState.exportCache?.entries || []).length;
  els.openRunnerBtn.disabled = !enabled || !(getSelectedCachedList()?.entries || []).length;
}

function getSelectedMeta() {
  const lists = appState.indexCache?.lists || [];
  return lists.find((list) => list.id === appState.selectedListId) || null;
}

function getSelectedCachedList() {
  const id = appState.selectedListId;
  return id ? appState.listCache[id] || null : null;
}

function emptyItem(message) {
  const li = document.createElement("li");
  li.textContent = message;
  return li;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function formatTime(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function log(message) {
  const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  logs.push(`[${time}] ${message}`);
  if (logs.length > 200) {
    logs.splice(0, logs.length - 200);
  }
  renderLogs();
}
