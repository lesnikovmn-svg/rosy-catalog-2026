export function jsonp(url, { timeoutMs = 12000 } = {}) {
  return new Promise((resolve, reject) => {
    const callbackName = `__jsonp_cb_${Math.random().toString(16).slice(2)}`;
    const script = document.createElement("script");
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error(`JSONP timeout: ${url}`));
    }, timeoutMs);

    function cleanup() {
      window.clearTimeout(timer);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (data) => {
      cleanup();
      resolve(data);
    };

    const sep = url.includes("?") ? "&" : "?";
    script.src = `${url}${sep}callback=${encodeURIComponent(callbackName)}`;
    script.onerror = () => {
      cleanup();
      reject(new Error(`JSONP load error: ${url}`));
    };

    document.head.appendChild(script);
  });
}
