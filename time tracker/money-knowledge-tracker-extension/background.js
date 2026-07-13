// Keeps the extension badge showing active timer count
// Timers themselves persist via chrome.storage timestamps

chrome.alarms.create("tick", { periodInMinutes: 0.5 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "tick") {
    chrome.storage.local.get("mk_timers", (r) => {
      const timers = r.mk_timers || {};
      const running = Object.values(timers).filter(t => t && t.startedAt).length;
      if (running > 0) {
        chrome.action.setBadgeText({ text: String(running) });
        chrome.action.setBadgeBackgroundColor({ color: "#27ae60" });
      } else {
        chrome.action.setBadgeText({ text: "" });
      }
    });
  }
});
