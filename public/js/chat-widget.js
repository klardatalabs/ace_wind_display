// "Ask the Turbine" — Interactive AI Chatbot Widget

function getSessionId() {
  let id = localStorage.getItem("ace_chat_session");
  if (!id) {
    id = "session-" + Math.random().toString(36).slice(2, 10) + "-" + Date.now();
    localStorage.setItem("ace_chat_session", id);
  }
  return id;
}

const sessionId = getSessionId();

// Inject Widget DOM into page
function initChatWidget() {
  const container = document.createElement("div");
  container.id = "turbine-chat-root";
  container.innerHTML = `
    <!-- Floating Action Button -->
    <button class="turbine-chat-fab" id="chat-fab" aria-label="Ask the Turbine AI Chat">
      <span class="fab-icon">💬</span>
      <span>Ask the Turbine</span>
      <span class="fab-dot"></span>
    </button>

    <!-- Chat Modal Drawer -->
    <div class="turbine-chat-modal" id="chat-modal">
      <div class="chat-header">
        <div class="chat-header-info">
          <div class="chat-avatar">🌾</div>
          <div>
            <h3 class="chat-title">Ask the Turbine</h3>
            <span class="chat-subtitle"><span class="fab-dot"></span> Live from Lawrence Weston · 150m</span>
          </div>
        </div>
        <button class="chat-close-btn" id="chat-close" title="Close Chat">✕</button>
      </div>

      <div class="chat-body" id="chat-body">
        <div class="chat-bubble assistant">
          <p>Hello! I am the <b>Lawrence Weston community wind turbine</b>, standing 150m tall in Avonmouth. Ask me anything about my live power, wind speeds, records, or who owns me!</p>
          <div class="chat-starter-chips" id="starter-chips">
            <button class="starter-chip" data-q="How much power are you generating right now?">⚡ How much power are you generating right now?</button>
            <button class="starter-chip" data-q="What is your all-time generation record?">🌟 What is your all-time generation record?</button>
            <button class="starter-chip" data-q="Who owns you and where does the money go?">🏡 Who owns you and where does the money go?</button>
            <button class="starter-chip" data-q="How did September compare to August?">📈 How did September compare to August?</button>
          </div>
        </div>
      </div>

      <div class="chat-footer">
        <input type="text" class="chat-input" id="chat-input" placeholder="Ask about generation, wind, records..." />
        <button class="chat-send-btn" id="chat-send">Send</button>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  const fab = document.getElementById("chat-fab");
  const modal = document.getElementById("chat-modal");
  const closeBtn = document.getElementById("chat-close");
  const sendBtn = document.getElementById("chat-send");
  const inputEl = document.getElementById("chat-input");
  const bodyEl = document.getElementById("chat-body");

  fab.addEventListener("click", () => {
    modal.classList.toggle("open");
    if (modal.classList.contains("open")) {
      inputEl.focus();
    }
  });

  closeBtn.addEventListener("click", () => {
    modal.classList.remove("open");
  });

  // Handle Starter Chips
  document.querySelectorAll(".starter-chip").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const q = e.target.getAttribute("data-q");
      if (q) {
        inputEl.value = q;
        sendMessage();
      }
    });
  });

  // Send message handler
  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = "";
    sendBtn.disabled = true;

    // Append user bubble
    appendBubble("user", text);

    // Append activity indicator
    const toolPill = document.createElement("div");
    toolPill.className = "chat-tool-pill";
    toolPill.textContent = "Checking turbine telemetry...";
    bodyEl.appendChild(toolPill);
    bodyEl.scrollTop = bodyEl.scrollHeight;

    // Create assistant bubble placeholder
    const assistantBubble = document.createElement("div");
    assistantBubble.className = "chat-bubble assistant";
    assistantBubble.innerHTML = "<p>...</p>";
    bodyEl.appendChild(assistantBubble);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, prompt: text }),
      });

      toolPill.remove();

      if (res.status === 429) {
        const data = await res.json();
        assistantBubble.innerHTML = `<p style="color:#f87171;">⚠️ ${data.error || "Rate limit reached. Please wait a moment."}</p>`;
      } else if (!res.ok) {
        assistantBubble.innerHTML = "<p>⚠️ I had trouble reading my sensors right now. Please try again shortly.</p>";
      } else {
        const data = await res.json();
        assistantBubble.innerHTML = formatMarkdown(data.answer);
      }
    } catch (err) {
      toolPill.remove();
      assistantBubble.innerHTML = "<p>⚠️ Network error connecting to turbine. Please check your connection.</p>";
    } finally {
      sendBtn.disabled = false;
      bodyEl.scrollTop = bodyEl.scrollHeight;
      inputEl.focus();
    }
  }

  sendBtn.addEventListener("click", sendMessage);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  function appendBubble(role, content) {
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${role}`;
    bubble.innerHTML = role === "user" ? `<p>${escapeHtml(content)}</p>` : formatMarkdown(content);
    bodyEl.appendChild(bubble);
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function formatMarkdown(text) {
  if (!text) return "";
  let html = text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n- (.*?)/g, "<br>• $1")
    .replace(/\n/g, "<br>");
  return `<p>${html}</p>`;
}

// Auto-initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initChatWidget);
} else {
  initChatWidget();
}
