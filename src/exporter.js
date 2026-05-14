(() => {
if (window.__zhihuBlacklistExporterInjected) {
  return;
}
window.__zhihuBlacklistExporterInjected = true;

const PROFILE_LINK_RE = /\/people\/([^/?#\s]+)/i;
const NEXT_TEXT_RE = /^(下一页|下一|下页|>|›|»)$/i;
const NEXT_HINT_RE = /(下一页|下一|next)/i;
const DISABLED_RE = /(disabled|is-disabled|Button--disabled)/i;
const GLOBAL_CONTAINER_SELECTOR = "header, nav, [role='banner'], .AppHeader, .GlobalSideBar, .Footer, .Topbar";
const USER_ROW_SELECTORS = [
  ".UserPageItem",
  ".List-item",
  ".ContentItem",
  ".UserItem",
  ".MemberItem",
  "li",
  "[role='listitem']"
];

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "exportOwnBlacklist") {
    return false;
  }

  exportOwnBlacklist(message.payload)
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error.message
      });
    });

  return true;
});

async function exportOwnBlacklist(payload = {}) {
  if (!location.hostname.endsWith("zhihu.com")) {
    throw new Error("当前页面不是知乎页面");
  }

  const maxPages = clamp(payload.maxPages, 1, 1000, 500);
  const seen = new Map();
  const logs = [];
  await ensureBlacklistEditorOpen(logs);

  const total = readTotalCount();
  let pages = 0;
  let reason = "";

  if (total) {
    logs.push(`页面显示总数：${total} 条`);
  }

  for (let i = 0; i < maxPages; i += 1) {
    await waitForStableDom(400);
    const before = seen.size;
    collectVisibleUsers(seen);
    const added = seen.size - before;
    pages += 1;
    logs.push(`第 ${pages} 页采集 ${added} 条`);

    if (total && seen.size >= total) {
      reason = "达到页面显示总数";
      break;
    }

    const next = findNextPageControl();
    if (!next) {
      reason = "没有找到下一页";
      break;
    }

    const signature = pageSignature();
    safeClick(next);
    const changed = await waitForPageChange(signature, 9000);
    if (!changed) {
      collectVisibleUsers(seen);
      reason = "下一页没有变化";
      break;
    }
  }

  if (!reason && pages >= maxPages) {
    reason = "达到页数上限";
  }

  return {
    ok: true,
    entries: Array.from(seen.values()),
    pages,
    total,
    reason,
    logs
  };
}

async function ensureBlacklistEditorOpen(logs) {
  if (document.querySelector("article.UserPage, .UserPage")) {
    logs.push("已检测到黑名单编辑列表");
    return;
  }

  if (!location.pathname.startsWith("/settings/filter")) {
    throw new Error("请先打开 https://www.zhihu.com/settings/filter");
  }

  const editButton = findBlacklistEditButton();
  if (!editButton) {
    throw new Error("没有找到用户黑名单的编辑按钮，请手动点击后重试");
  }

  logs.push("已找到用户黑名单编辑按钮，正在打开");
  safeClick(editButton);

  const opened = await waitFor(() => document.querySelector("article.UserPage, .UserPage"), 8000);
  if (!opened) {
    throw new Error("没有检测到黑名单编辑列表，请等待页面加载后重试");
  }

  await waitForStableDom(400);
}

function findBlacklistEditButton() {
  const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, div, span"))
    .filter((el) => textOf(el) === "用户黑名单");

  for (const heading of headings) {
    let node = heading;
    for (let depth = 0; node && depth < 8; depth += 1) {
      const button = Array.from(node.querySelectorAll("button, [role='button']"))
        .filter(isVisible)
        .filter((el) => !isDisabled(el))
        .find((el) => textOf(el) === "编辑");
      if (button) {
        return button;
      }
      node = node.parentElement;
    }
  }

  return Array.from(document.querySelectorAll("button, [role='button']"))
    .filter(isVisible)
    .filter((el) => !isDisabled(el))
    .find((button) => {
      if (textOf(button) !== "编辑") {
        return false;
      }

      let node = button.parentElement;
      for (let depth = 0; node && depth < 8; depth += 1) {
        if (textOf(node).includes("用户黑名单")) {
          return true;
        }
        node = node.parentElement;
      }
      return false;
    }) || null;
}

function collectVisibleUsers(seen) {
  const root = collectionRoot();
  const links = Array.from(root.querySelectorAll(".UserPageItem-link[href*='/people/'], a[href*='/people/']"))
    .filter(isVisible)
    .filter((link) => !link.closest(GLOBAL_CONTAINER_SELECTOR));

  for (const link of links) {
    const token = userTokenFromLink(link);
    if (!token) {
      continue;
    }

    const key = token.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    const row = closestUserRow(link, root);
    const name = cleanUserName(
      link.getAttribute("title") ||
      link.querySelector(".UserPageItem-name")?.textContent ||
      link.textContent ||
      link.getAttribute("aria-label") ||
      token
    );
    seen.set(key, {
      token,
      name,
      url: `https://www.zhihu.com/people/${encodeURIComponent(token)}`,
      text: row ? textOf(row).slice(0, 300) : name
    });
  }
}

function collectionRoot() {
  const candidates = [
    document.querySelector("article.UserPage"),
    document.querySelector(".UserPage"),
    document.querySelector(".UserPageContent"),
    document.querySelector("[role='main']"),
    document.querySelector("main"),
    document.querySelector(".Settings-main"),
    document.querySelector(".ContentLayout-mainColumn"),
    document.querySelector(".App-main"),
    document.body
  ].filter(Boolean);

  const withBlacklistText = candidates.find((node) => /黑名单|屏蔽|blocked/i.test(textOf(node).slice(0, 1000)));
  return withBlacklistText || candidates[0] || document.body;
}

function closestUserRow(link, scope) {
  for (const selector of USER_ROW_SELECTORS) {
    const row = link.closest(selector);
    if (row && scope.contains(row)) {
      return row;
    }
  }

  let node = link.parentElement;
  for (let depth = 0; node && node !== scope && depth < 7; depth += 1) {
    const peopleLinks = node.querySelectorAll("a[href*='/people/']");
    if (peopleLinks.length > 0 && peopleLinks.length <= 3 && textOf(node).length > 0) {
      return node;
    }
    node = node.parentElement;
  }

  return link.parentElement;
}

function findNextPageControl() {
  const preferred = [
    ".UserPage .UserPage-pagerRight",
    "article.UserPage .UserPage-pagerRight",
    ".UserPage-pagerRight",
    "button[aria-label*='下一']",
    "a[aria-label*='下一']",
    "button[title*='下一']",
    "a[title*='下一']",
    ".PaginationButton-next",
    ".Pagination-next",
    ".Pagination button:last-child",
    ".Pagination a:last-child"
  ];

  for (const selector of preferred) {
    const match = Array.from(document.querySelectorAll(selector))
      .filter(isVisible)
      .find((el) => !isDisabled(el) && looksLikeNext(el));
    if (match) {
      return match;
    }
  }

  return Array.from(document.querySelectorAll("button, a, [role='button']"))
    .filter(isVisible)
    .filter((el) => !isDisabled(el))
    .find(looksLikeNext) || null;
}

function looksLikeNext(el) {
  const label = controlLabel(el);
  if (NEXT_TEXT_RE.test(label) || NEXT_HINT_RE.test(label)) {
    return true;
  }

  const className = String(el.className || "");
  if (/\bUserPage-pagerRight\b/.test(className)) {
    return true;
  }

  return /next/i.test(className) && /page|pagination/i.test(className + " " + textOf(el.closest("[class*='Pagination'], [class*='pagination']")));
}

function readTotalCount() {
  const root = collectionRoot();
  const text = textOf(root.querySelector("footer") || root);
  const match = text.match(/共\s*([0-9,，]+)\s*用户被拉黑/);
  if (!match) {
    return 0;
  }

  const total = Number(match[1].replace(/[,，]/g, ""));
  return Number.isFinite(total) ? total : 0;
}

function isDisabled(el) {
  return Boolean(
    el.disabled ||
    el.getAttribute("aria-disabled") === "true" ||
    DISABLED_RE.test(String(el.className || "")) ||
    el.closest("[aria-disabled='true']")
  );
}

function pageSignature() {
  const root = collectionRoot();
  const tokens = Array.from(root.querySelectorAll("a[href*='/people/']"))
    .filter(isVisible)
    .map(userTokenFromLink)
    .filter(Boolean)
    .join("|");
  const pageText = textOf(root).slice(0, 800);
  return `${location.href}::${tokens}::${pageText}`;
}

function waitForPageChange(signature, timeout) {
  const start = Date.now();

  return new Promise((resolve) => {
    const tick = () => {
      if (pageSignature() !== signature) {
        resolve(true);
        return;
      }

      if (Date.now() - start >= timeout) {
        resolve(false);
        return;
      }

      setTimeout(tick, 250);
    };

    setTimeout(tick, 600);
  });
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

function waitForStableDom(ms) {
  return new Promise((resolve) => {
    let timer = setTimeout(done, ms);
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(done, ms);
    });

    function done() {
      observer.disconnect();
      resolve();
    }

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  });
}

function userTokenFromLink(link) {
  const href = link.href || link.getAttribute("href") || "";
  const match = href.match(PROFILE_LINK_RE);
  if (!match) {
    return "";
  }

  try {
    return decodeURIComponent(match[1]).trim();
  } catch (error) {
    return "";
  }
}

function safeClick(el) {
  scrollIntoView(el);
  el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true, view: window }));
  el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
  el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
  el.click();
}

function scrollIntoView(el) {
  el.scrollIntoView({ block: "center", inline: "center" });
}

function clamp(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function cleanUserName(value) {
  return value.replace(/\s+/g, " ").trim() || "未知用户";
}

function controlLabel(el) {
  return `${el?.getAttribute("aria-label") || ""} ${el?.title || ""} ${textOf(el)}`.replace(/\s+/g, " ").trim();
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
})();
