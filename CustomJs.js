<script>
  (function () {
  // ================= CONFIG =================
  const APP_URL = "http://localhost:5173";
  const BACKEND_URL = "http://localhost:3001";
  const VERIFY_ENDPOINT = `${BACKEND_URL}/auth/verify`;

  const APP_ORIGIN = new URL(APP_URL).origin;
  const AUTH_REQUEST = "GHL_OBS_AUTH_REQUEST";
  const AUTH_RESPONSE = "GHL_OBS_AUTH_RESPONSE";
  const AUTH_PUSH = "GHL_OBS_AUTH_PUSH";

  const TOKEN_STORAGE_KEY = (locationId) => `obs_token_${locationId}`;

  let OBS_VERIFIED = false;
  let OBS_INIT_RUNNING = false;
  let OBS_LOCATION_ID = null;
  let OBS_APP_TOKEN = null;
  let OBS_CLICK_LISTENER_BOUND = false;
  let OBS_MESSAGE_LISTENER_BOUND = false;

  // ================= HELPERS =================
  function waitForElement(selector, timeout = 7000) {
    return new Promise((resolve, reject) => {
      const interval = 100;
  let elapsed = 0;

      const timer = setInterval(() => {
        const el = document.querySelector(selector);
  if (el) {
    clearInterval(timer);
  resolve(el);
        }

  elapsed += interval;
        if (elapsed >= timeout) {
    clearInterval(timer);
  reject(new Error(`Element not found: ${selector}`));
        }
      }, interval);
    });
  }

  function getCurrentRoute() {
    try {
      return AppUtils.RouteHelper.getCurrentRoute();
    } catch (err) {
    console.log("Failed to read current route:", err);
  return null;
    }
  }

  function getAgentIdFromRoute() {
    const route = getCurrentRoute();
  if (!route || !route.path) return null;

  const parts = route.path.split("/").filter(Boolean);
  const voiceAiIndex = parts.indexOf("voice-ai");

  if (voiceAiIndex === -1) return null;
  return parts[voiceAiIndex + 1] || null;
  }

  async function getStoredToken(locationId) {
    try {
      return await AppUtils.Storage.getData(TOKEN_STORAGE_KEY(locationId));
    } catch (err) {
    console.log("Failed to read token from storage:", err);
  return null;
    }
  }

  async function clearStoredToken(locationId) {
    try {
    await AppUtils.Storage.setData(TOKEN_STORAGE_KEY(locationId), null);
    } catch (err) {
    console.log("Failed to clear stored token:", err);
    }
  }

  // ================= VERIFY =================
  async function isAppInstalled(locationId) {
    try {
      const res = await fetch(VERIFY_ENDPOINT, {
    method: "POST",
  headers: {"Content-Type": "application/json" },
  body: JSON.stringify({locationId})
      });

  if (!res.ok) {
    OBS_APP_TOKEN = null;
  await clearStoredToken(locationId);
  return false;
      }

  const data = await res.json();

  if (data.token) {
    OBS_APP_TOKEN = data.token;
  OBS_LOCATION_ID = locationId;
  await AppUtils.Storage.setData(TOKEN_STORAGE_KEY(locationId), data.token);
  return true;
      }

  OBS_APP_TOKEN = null;
  await clearStoredToken(locationId);
  return false;
    } catch (err) {
    console.log("Verify failed:", err);
  OBS_APP_TOKEN = null;
  return false;
    }
  }

  // ================= IFRAME AUTH BRIDGE =================
  async function sendAuthToIframe(targetWindow) {
    if (!targetWindow || !OBS_LOCATION_ID) return;

  const token = OBS_APP_TOKEN || await getStoredToken(OBS_LOCATION_ID);
  if (!token) return;

  targetWindow.postMessage(
  {
    type: AUTH_PUSH,
  token,
  locationId: OBS_LOCATION_ID
      },
  APP_ORIGIN
  );
  }

  function bindParentMessageBridge() {
    if (OBS_MESSAGE_LISTENER_BOUND) return;
  OBS_MESSAGE_LISTENER_BOUND = true;

    window.addEventListener("message", async (event) => {
      if (event.origin !== APP_ORIGIN) return;

  const data = event.data || { };
  if (data.type !== AUTH_REQUEST) return;
  if (!OBS_LOCATION_ID) return;

  const token = OBS_APP_TOKEN || await getStoredToken(OBS_LOCATION_ID);
  if (!token || !event.source) return;

  event.source.postMessage(
  {
    type: AUTH_RESPONSE,
  token,
  locationId: OBS_LOCATION_ID
        },
  event.origin
  );
    });
  }

  // ================= TAB =================
  function injectTab() {
    if (!OBS_VERIFIED) {
    console.log("Blocked tab injection because app is not verified");
  return;
    }

  const wrapper = document.querySelector(".n-tabs-wrapper");
  if (!wrapper) return;

  if (document.getElementById("obs-tab-wrapper")) return;

  const tabWrapper = document.createElement("div");
  tabWrapper.className = "n-tabs-tab-wrapper";
  tabWrapper.id = "obs-tab-wrapper";

  const pad = document.createElement("div");
  pad.className = "n-tabs-tab-pad";

  const tab = document.createElement("div");
  tab.className = "n-tabs-tab";
  tab.setAttribute("data-name", "OBSERVABILITY");

  const label = document.createElement("span");
  label.className = "n-tabs-tab__label";
  label.innerText = "Observability";

  tab.appendChild(label);

    tab.onclick = () => {
    setActiveTab(tab);
  renderIframe();
    };

  tabWrapper.appendChild(pad);
  tabWrapper.appendChild(tab);

  const paddings = wrapper.querySelectorAll(".n-tabs-scroll-padding");
    if (paddings.length > 0) {
    wrapper.insertBefore(tabWrapper, paddings[paddings.length - 1]);
    } else {
    wrapper.appendChild(tabWrapper);
    }
  }

  function removeTabIfExists() {
    const existing = document.getElementById("obs-tab-wrapper");
  if (existing) existing.remove();
  }

  // ================= INDICATOR =================
  function moveIndicator(tab) {
    const bar = document.querySelector(".n-tabs-bar");
  const container = document.querySelector(".n-tabs-nav-scroll-content");
  if (!bar || !tab || !container) return;

  const tabRect = tab.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  bar.style.left = `${tabRect.left - containerRect.left}px`;
  bar.style.width = `${tabRect.width}px`;
  }

  function setActiveTab(tabEl) {
    document.querySelectorAll(".n-tabs-tab").forEach((t) => {
      t.classList.remove("n-tabs-tab--active");
    });

  tabEl.classList.add("n-tabs-tab--active");
  moveIndicator(tabEl);
  }

  // ================= PANE =================
  function resetObservabilityTab() {
    const obsTab = document.querySelector('[data-name="OBSERVABILITY"]');
  if (obsTab) obsTab.classList.remove("n-tabs-tab--active");

  const obsPane = document.getElementById("obs-custom-pane");
  if (obsPane) obsPane.remove();
  }

  function renderIframe() {
    const parent = document.querySelector(".tab-content");
  const agentId = getAgentIdFromRoute();

  if (!parent || !agentId || !OBS_LOCATION_ID) return;

  let obsPane = document.getElementById("obs-custom-pane");
  if (obsPane) obsPane.remove();

  obsPane = document.createElement("div");
  obsPane.id = "obs-custom-pane";

  Object.assign(obsPane.style, {
    position: "absolute",
  inset: "0",
  background: "#fff",
  zIndex: "1"
    });

  parent.style.position = "relative";
  parent.appendChild(obsPane);

  const iframe = document.createElement("iframe");
  iframe.src = `${APP_URL}/agents/${encodeURIComponent(agentId)}?location_id=${encodeURIComponent(OBS_LOCATION_ID)}`;
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "none";
  iframe.setAttribute("allow", "clipboard-read; clipboard-write");

    iframe.addEventListener("load", () => {
    sendAuthToIframe(iframe.contentWindow);
    });

  obsPane.appendChild(iframe);
  }

  // ================= LISTENERS =================
  function bindTabResetListener() {
    if (OBS_CLICK_LISTENER_BOUND) return;
  OBS_CLICK_LISTENER_BOUND = true;

    document.addEventListener("click", (e) => {
      const tab = e.target.closest(".n-tabs-tab");
  if (!tab) return;

  if (tab.getAttribute("data-name") !== "OBSERVABILITY") {
    resetObservabilityTab();
      }
    });
  }

  // ================= INIT =================
  async function init() {
    if (OBS_INIT_RUNNING) return;
  OBS_INIT_RUNNING = true;

  try {
    await waitForElement(".n-tabs-wrapper");

  const agentId = getAgentIdFromRoute();
  if (!agentId) {
    removeTabIfExists();
  resetObservabilityTab();
  OBS_INIT_RUNNING = false;
  return;
      }

  const location = await AppUtils.Utilities.getCurrentLocation();
  if (!location || !location.id) {
    removeTabIfExists();
  resetObservabilityTab();
  OBS_INIT_RUNNING = false;
  return;
      }

  OBS_LOCATION_ID = location.id;

  const installed = await isAppInstalled(location.id);
  OBS_VERIFIED = installed;

  if (!installed) {
    removeTabIfExists();
  resetObservabilityTab();
  OBS_INIT_RUNNING = false;
  return;
      }

  bindParentMessageBridge();
  bindTabResetListener();
  injectTab();
    } catch (err) {
    console.log("Observability init failed:", err);
    } finally {
    OBS_INIT_RUNNING = false;
    }
  }

  window.addEventListener("routeLoaded", init);
  window.addEventListener("routeChangeEvent", init);
  init();
})();
</script>
