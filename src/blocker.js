(() => {
if (window.__zhihuProfileBlockerInjected) {
  return;
}
window.__zhihuProfileBlockerInjected = true;

const PROFILE_LINK_RE = /\/people\/([^/?#\s]+)/i;
const CONFIRM_TITLE_RE = /^确定要屏蔽.+？?$/;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "blockCurrentProfile") {
    return false;
  }

  blockCurrentProfile(message.payload)
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        ok: false,
        state: "failed",
        error: error.message
      });
    });

  return true;
});

async function blockCurrentProfile(payload = {}) {
  const token = currentProfileToken();
  const expectedToken = String(payload.token || "").trim();
  if (!token) {
    throw new Error("当前页面不是知乎个人主页");
  }
  if (expectedToken && token.toLowerCase() !== expectedToken.toLowerCase()) {
    throw new Error(`当前页面 token 不匹配：${token}`);
  }

  await waitForStableDom(500);

  if (isAlreadyBlocked()) {
    return {
      ok: true,
      state: "already-blocked",
      token,
      message: "已在屏蔽状态"
    };
  }

  const blockButton = findBlockButton();
  if (!blockButton) {
    throw new Error("没有找到个人主页的“屏蔽用户”按钮");
  }

  if (payload.dryRun) {
    return {
      ok: true,
      state: "dry-run",
      token,
      message: "试运行：已找到屏蔽用户按钮"
    };
  }

  safeClick(blockButton);

  const modal = await waitFor(findBlockConfirmModal, 5000);
  if (!modal) {
    throw new Error("点击屏蔽用户后没有出现确认框");
  }

  const confirmButton = findConfirmButton(modal);
  if (!confirmButton) {
    throw new Error("确认框里没有找到“确定”按钮");
  }

  safeClick(confirmButton);

  const completed = await waitFor(() => !findBlockConfirmModal(), 8000);
  if (!completed) {
    throw new Error("确认后弹窗没有关闭，可能未完成");
  }

  await waitForStableDom(500);

  return {
    ok: true,
    state: "blocked",
    token,
    message: "已点击确认屏蔽"
  };
}

function currentProfileToken() {
  const metaUrl = document.querySelector("meta[itemprop='url']")?.content || "";
  const href = metaUrl || location.pathname;
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

function findBlockButton() {
  const scoped = Array.from(document.querySelectorAll(".Profile-footerOperations button"))
    .filter(isVisible)
    .find((button) => textOf(button) === "屏蔽用户");
  if (scoped) {
    return scoped;
  }

  return Array.from(document.querySelectorAll("button, [role='button']"))
    .filter(isVisible)
    .find((button) => textOf(button) === "屏蔽用户") || null;
}

function isAlreadyBlocked() {
  return Array.from(document.querySelectorAll("button, [role='button']"))
    .filter(isVisible)
    .some((button) => /取消屏蔽|已屏蔽/.test(textOf(button)));
}

function findBlockConfirmModal() {
  return Array.from(document.querySelectorAll(".Modal, [role='dialog']"))
    .filter(isVisible)
    .find((modal) => {
      const title = textOf(modal.querySelector(".Modal-title, h1, h2, h3"));
      return CONFIRM_TITLE_RE.test(title) && textOf(modal).includes("屏蔽后");
    }) || null;
}

function findConfirmButton(modal) {
  return Array.from(modal.querySelectorAll(".ModalButtonGroup button, button"))
    .filter(isVisible)
    .find((button) => textOf(button) === "确定") || null;
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
