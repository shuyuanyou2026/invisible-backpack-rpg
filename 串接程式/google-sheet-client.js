/* 隱形背包｜匿名遊玩紀錄。部署網址由專案維護者設定。 */
(() => {
  "use strict";
  const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyYKtXak69zZJ6MVmkFpylVmims54YwT85H3V_cTXaBIRzUwSWX_eCGQ98gV9PsDJAh9g/exec";
  const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

  function createId() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  }

  function status(submissionId) {
    return new Promise((resolve, reject) => {
      const callback = "__backpackStatus_" + createId();
      const script = document.createElement("script");
      const timeout = setTimeout(() => finish(new Error("STATUS_TIMEOUT")), 7000);
      function finish(error, result) {
        clearTimeout(timeout);
        script.remove();
        window[callback] = () => {};
        setTimeout(() => { delete window[callback]; }, 30000);
        if (error) reject(error); else resolve(result);
      }
      window[callback] = result => {
        if (!result || result.submissionId !== submissionId || !result.ok) {
          finish(new Error("STATUS_REJECTED"));
          return;
        }
        finish(null, result);
      };
      script.onerror = () => finish(new Error("STATUS_UNAVAILABLE"));
      const url = new URL(GOOGLE_SCRIPT_URL);
      url.searchParams.set("action", "status");
      url.searchParams.set("submissionId", submissionId);
      url.searchParams.set("callback", callback);
      url.searchParams.set("_", Date.now().toString());
      script.src = url.href;
      script.referrerPolicy = "no-referrer";
      document.head.appendChild(script);
    });
  }

  async function submit(data) {
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(GOOGLE_SCRIPT_URL)) {
      throw new Error("CONNECTION_NOT_READY");
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        credentials: "omit",
        keepalive: true,
        referrerPolicy: "no-referrer",
        headers: {"Content-Type": "text/plain;charset=UTF-8"},
        body: JSON.stringify(data),
        signal: controller.signal
      });
    } catch (error) {
      // 請求中斷也可能已寫入；仍查詢提交狀態，避免盲目重複送出。
    } finally {
      clearTimeout(timeout);
    }
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        const result = await status(data.submissionId);
        if (result.saved) return result;
      } catch (error) {
        // 可能是暫時連線失敗，有限次重查；不把 opaque 回應當作成功。
      }
      if (attempt < 7) await delay(1200);
    }
    throw new Error("SAVE_NOT_CONFIRMED");
  }

  window.BackpackSheets = Object.freeze({createId, submit});
})();
