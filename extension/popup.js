let origin;
const status = message => { document.getElementById("status").textContent = message; };
chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
  const url = new URL(tab.url);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("通常のHTTP・HTTPSサイトで利用してください。");
  origin = url.protocol + "//" + url.hostname + "/*";
  document.getElementById("host").textContent = url.hostname;
  const granted = await chrome.permissions.contains({ origins: [origin] });
  document.getElementById("grant").disabled = granted;
  if (granted) status("このサイトは許可済みです。");
}).catch(error => { document.getElementById("host").textContent = "このページでは利用できません。"; status(error.message); });
document.getElementById("grant").addEventListener("click", async () => {
  try {
    if (!await chrome.permissions.request({ origins: [origin] })) { status("許可がキャンセルされました。"); return; }
    const result = await chrome.runtime.sendMessage({ type: "sync" }); if (result.error) throw new Error(result.error);
    document.getElementById("grant").disabled = true; status("許可しました。ページを再読み込みしてください。");
  } catch (error) { status(error.message); }
});
document.getElementById("options").addEventListener("click", () => chrome.runtime.openOptionsPage());
