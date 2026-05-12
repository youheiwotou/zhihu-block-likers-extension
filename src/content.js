(() => {
if (window.__zhihuBlockLikersInjected) {
  return;
}
window.__zhihuBlockLikersInjected = true;

const BLOCKER_TEXT = /^(屏蔽|拉黑|加入黑名单|不看\s*TA|不看他|不看她|屏蔽该用户|屏蔽用户)$/;
const CONFIRM_TEXT = /^(确定|确认|屏蔽|拉黑|加入黑名单)$/;
const LIKER_TEXT = /(人赞同|赞同者|赞同了该回答|查看全部.*赞同|查看.*赞同)/;
const PROFILE_LINK_RE = /\/people\/([^/?#]+)/;

const runner = {
  state: "idle",
  settings: null,
  seenUsers: new Map(),
  logs: [],
  processed: 0,
  failed: 0,
  stopRequested: false,
  pauseRequested: false,
  pageMessage: "已连接知乎页面"
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((error) => {
      log(`异常：${error.message}`);
      runner.state = "error";
      sendResponse(status());
    });
  return true;
});

async function handleMessage(message) {
  switch (message?.type) {
    case "getStatus":
      updatePageMessage();
      return status();
    case "openLikerList":
      await openLikerList();
      return status();
    case "start":
      start(message.payload);
      return status();
    case "pause":
      runner.pauseRequested = true;
      runner.state = "paused";
      log("已暂停");
      return status();
    case "resume":
      runner.pauseRequested = false;
      runner.state = "running";
      log("继续执行");
      return status();
    case "stop":
      runner.stopRequested = true;
      runner.pauseRequested = false;
      runner.state = "stopped";
      log("正在停止");
      return status();
    default:
      return status();
  }
}

function start(settings) {
  if (runner.state === "running") {
    return;
  }

  runner.settings = normalizeSettings(settings);
  runner.seenUsers = new Map();
  runner.logs = [];
  runner.processed = 0;
  runner.failed = 0;
  runner.stopRequested = false;
  runner.pauseRequested = false;
  runner.state = "running";
  log(`开始任务，上限 ${runner.settings.maxUsers} 人，间隔 ${runner.settings.minDelay}-${runner.settings.maxDelay}ms${runner.settings.dryRun ? "，试运行" : ""}`);

  runBlockJob().catch((error) => {
    runner.state = "error";
    log(`任务异常：${error.message}`);
  });
}

function normalizeSettings(settings = {}) {
  const minDelay = clamp(settings.minDelay, 500, 60000, 1600);
  const maxDelay = clamp(settings.maxDelay, minDelay, 60000, 3200);
  return {
    maxUsers: clamp(settings.maxUsers, 1, 1000, 50),
    minDelay,
    maxDelay,
    dryRun: Boolean(settings.dryRun)
  };
}

function clamp(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

async function runBlockJob() {
  const modal = await ensureLikerListOpen();
  if (!modal) {
    runner.state = "error";
    log("没有找到点赞列表。请先打开回答页，或手动点开赞同者列表后再开始。");
    return;
  }

  while (runner.state === "running" || runner.state === "paused") {
    if (runner.stopRequested) {
      runner.state = "stopped";
      log("任务已停止");
      return;
    }

    await waitIfPaused();

    const nextUser = findNextUser(modal);
    if (!nextUser) {
      const loadedMore = await scrollLikerList(modal);
      if (!loadedMore) {
        runner.state = "done";
        log("没有更多可处理用户");
        return;
      }
      continue;
    }

    runner.seenUsers.set(nextUser.token, {
      token: nextUser.token,
      name: nextUser.name,
      state: "processing"
    });

    if (runner.settings.dryRun) {
      runner.processed += 1;
      runner.seenUsers.get(nextUser.token).state = "dry-run";
      log(`识别：${nextUser.name}`);
    } else {
      const ok = await blockUser(nextUser);
      if (ok) {
        runner.processed += 1;
        runner.seenUsers.get(nextUser.token).state = "blocked";
        log(`已处理：${nextUser.name}`);
      } else {
        runner.failed += 1;
        runner.seenUsers.get(nextUser.token).state = "failed";
        log(`失败：${nextUser.name}`);
      }
    }

    if (runner.processed >= runner.settings.maxUsers) {
      runner.state = "done";
      log("已达到处理上限");
      return;
    }

    await delay(randomBetween(runner.settings.minDelay, runner.settings.maxDelay));
  }
}

async function ensureLikerListOpen() {
  const opened = findLikerModal();
  if (opened) {
    return opened;
  }

  await openLikerList();
  return findLikerModal();
}

async function openLikerList() {
  if (findLikerModal()) {
    log("点赞列表已打开");
    return;
  }

  const trigger = findLikerTrigger();
  if (!trigger) {
    log("没有找到点赞列表入口，请手动点开赞同者列表");
    return;
  }

  safeClick(trigger);
  log("已尝试打开点赞列表");
  await waitFor(findLikerModal, 4000);
}

function findLikerTrigger() {
  const clickable = Array.from(document.querySelectorAll("button, a, [role='button'], .NumberBoard-item, .Voters"))
    .filter(isVisible)
    .filter((el) => LIKER_TEXT.test(textOf(el)));

  const answerScoped = clickable.find((el) => closestAnswer(el));
  return answerScoped || clickable[0] || null;
}

function findLikerModal() {
  const candidates = Array.from(document.querySelectorAll("[role='dialog'], .Modal, .Modal-content, .Voters"))
    .filter(isVisible);

  for (const candidate of candidates) {
    const links = findProfileLinks(candidate);
    const title = textOf(candidate).slice(0, 200);
    if (links.length > 0 && (/赞同|赞同者|关注者|全部/.test(title) || candidate.matches(".Voters, .Modal, .Modal-content, [role='dialog']"))) {
      return candidate;
    }
  }

  return null;
}

function findNextUser(scope) {
  const rows = findUserRows(scope);
  for (const row of rows) {
    const link = findProfileLinks(row)[0];
    if (!link) {
      continue;
    }

    const token = userTokenFromLink(link);
    if (!token || runner.seenUsers.has(token)) {
      continue;
    }

    return {
      row,
      link,
      token,
      name: cleanUserName(link.textContent || link.getAttribute("aria-label") || token)
    };
  }
  return null;
}

function findUserRows(scope) {
  const links = findProfileLinks(scope);
  const rows = [];
  const seen = new Set();

  for (const link of links) {
    const row = closestUserRow(link, scope);
    if (!row || seen.has(row)) {
      continue;
    }
    seen.add(row);
    rows.push(row);
  }

  return rows;
}

function findProfileLinks(scope) {
  return Array.from(scope.querySelectorAll("a[href*='/people/']"))
    .filter(isVisible)
    .filter((link) => PROFILE_LINK_RE.test(link.href));
}

function closestUserRow(link, scope) {
  const selectors = [
    ".List-item",
    ".ContentItem",
    ".UserItem",
    ".MemberItem",
    "li",
    "[role='listitem']"
  ];

  for (const selector of selectors) {
    const row = link.closest(selector);
    if (row && scope.contains(row)) {
      return row;
    }
  }

  let node = link.parentElement;
  for (let depth = 0; node && node !== scope && depth < 6; depth += 1) {
    if (node.querySelectorAll("a[href*='/people/']").length === 1 && textOf(node).length > 0) {
      return node;
    }
    node = node.parentElement;
  }

  return link.parentElement;
}

async function blockUser(user) {
  safeClick(user.row);
  await delay(200);

  const directButton = findDirectBlockButton(user.row);
  if (directButton) {
    safeClick(directButton);
    const confirmButton = await waitFor(() => findConfirmButton(), 2500);
    if (confirmButton) {
      safeClick(confirmButton);
    }
    await delay(500);
    return true;
  }

  const menuOpened = await openUserActionMenu(user.row);
  if (!menuOpened) {
    return false;
  }

  const blockItem = await waitFor(() => findMenuItem(BLOCKER_TEXT), 2000);
  if (!blockItem) {
    closeFloatingLayers();
    return false;
  }

  safeClick(blockItem);

  const confirmButton = await waitFor(() => findConfirmButton(), 2500);
  if (confirmButton) {
    safeClick(confirmButton);
    await delay(500);
  }

  return true;
}

async function openUserActionMenu(row) {
  const menuButtons = Array.from(row.querySelectorAll("button, [role='button']"))
    .filter(isVisible)
    .filter((button) => {
      const label = `${button.getAttribute("aria-label") || ""} ${button.title || ""} ${textOf(button)}`.trim();
      return /更多|操作|设置|菜单|···|\.\.\.|…/.test(label) || textOf(button).length <= 2;
    });

  for (const button of menuButtons.reverse()) {
    safeClick(button);
    const item = await waitFor(() => findMenuItem(BLOCKER_TEXT), 1200);
    if (item) {
      return true;
    }
  }

  return false;
}

function findDirectBlockButton(row) {
  return Array.from(row.querySelectorAll("button, [role='button'], a"))
    .filter(isVisible)
    .find((el) => BLOCKER_TEXT.test(textOf(el)));
}

function findMenuItem(textRe) {
  const selectors = [
    "[role='menuitem']",
    ".Menu-item",
    ".Popover-content button",
    ".Popover-content a",
    ".Popover-content [role='button']",
    ".Modal button",
    "button"
  ];

  return Array.from(document.querySelectorAll(selectors.join(",")))
    .filter(isVisible)
    .find((el) => textRe.test(textOf(el)));
}

function findConfirmButton() {
  const modalLike = Array.from(document.querySelectorAll("[role='dialog'], .Modal, .Modal-content"))
    .filter(isVisible)
    .reverse();

  for (const scope of modalLike) {
    const button = Array.from(scope.querySelectorAll("button"))
      .filter(isVisible)
      .find((el) => CONFIRM_TEXT.test(textOf(el)));
    if (button) {
      return button;
    }
  }

  return null;
}

async function scrollLikerList(modal) {
  const scroller = findScrollable(modal) || document.scrollingElement || document.documentElement;
  const before = findProfileLinks(modal).length;
  const beforeTop = scroller.scrollTop;
  scroller.scrollTop += Math.max(360, Math.floor(scroller.clientHeight * 0.8));
  scroller.dispatchEvent(new Event("scroll", { bubbles: true }));

  await delay(1000);

  const after = findProfileLinks(modal).length;
  const moved = scroller.scrollTop !== beforeTop;
  if (after > before) {
    log(`加载更多，当前发现 ${after} 人`);
    return true;
  }
  return moved && after > runner.seenUsers.size;
}

function findScrollable(root) {
  const nodes = [root, ...root.querySelectorAll("*")].filter((el) => {
    const style = getComputedStyle(el);
    return /(auto|scroll)/.test(`${style.overflowY} ${style.overflow}`) && el.scrollHeight > el.clientHeight + 20;
  });

  return nodes.sort((a, b) => b.scrollHeight - a.scrollHeight)[0] || null;
}

function closestAnswer(el) {
  return el.closest(".AnswerItem, [data-zop], [itemtype*='Answer'], .QuestionAnswer-content");
}

function closeFloatingLayers() {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
}

function safeClick(el) {
  el.scrollIntoView({ block: "center", inline: "center" });
  el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true, view: window }));
  el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
  el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
  el.click();
}

async function waitIfPaused() {
  while (runner.pauseRequested && !runner.stopRequested) {
    await delay(300);
  }
}

function waitFor(fn, timeout = 3000, interval = 100) {
  const start = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      const value = fn();
      if (value) {
        resolve(value);
        return;
      }
      if (Date.now() - start >= timeout) {
        resolve(null);
        return;
      }
      setTimeout(tick, interval);
    };
    tick();
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function userTokenFromLink(link) {
  const match = link.href.match(PROFILE_LINK_RE);
  return match ? decodeURIComponent(match[1]) : "";
}

function cleanUserName(value) {
  return value.replace(/\s+/g, " ").trim() || "未知用户";
}

function textOf(el) {
  return (el?.innerText || el?.textContent || "").replace(/\s+/g, " ").trim();
}

function isVisible(el) {
  if (!el || !(el instanceof Element)) {
    return false;
  }
  const rect = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
}

function updatePageMessage() {
  if (!location.hostname.endsWith("zhihu.com")) {
    runner.pageMessage = "请切换到知乎网页";
  } else if (findLikerModal()) {
    runner.pageMessage = "已检测到点赞列表";
  } else if (findLikerTrigger()) {
    runner.pageMessage = "已检测到回答页";
  } else {
    runner.pageMessage = "请打开知乎回答页或点赞列表";
  }
}

function status() {
  updatePageMessage();
  return {
    state: runner.state,
    found: runner.seenUsers.size || (findLikerModal() ? findProfileLinks(findLikerModal()).length : 0),
    processed: runner.processed,
    failed: runner.failed,
    pageMessage: runner.pageMessage,
    logs: runner.logs.slice(-80)
  };
}

function log(message) {
  const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  runner.logs.push(`[${time}] ${message}`);
  if (runner.logs.length > 200) {
    runner.logs.splice(0, runner.logs.length - 200);
  }
}
})();
