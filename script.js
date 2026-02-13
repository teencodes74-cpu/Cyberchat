// Cloudflare Worker endpoint for CyberChat.
const WORKER_URL = "https://cyberchat.teencodes74.workers.dev/";
const REQUEST_TIMEOUT_MS = 30000;

const chatForm = document.getElementById("chatForm");
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const clearChatBtn = document.getElementById("clearChatBtn");
const errorBanner = document.getElementById("errorBanner");
const sendIcon = sendBtn.querySelector(".send-icon");
const sendSpinner = sendBtn.querySelector(".send-spinner");

addMessage("ai", "Hi! I'm CyberChat. Ask me anything.");

chatForm.addEventListener("submit", onSubmitMessage);
chatInput.addEventListener("keydown", onInputKeyDown);
chatInput.addEventListener("input", autoResizeInput);
clearChatBtn.addEventListener("click", clearChat);

// Send on Enter, but allow Shift+Enter for new lines.
function onInputKeyDown(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
}

// Grow textarea as the user types.
function autoResizeInput() {
  chatInput.style.height = "auto";
  chatInput.style.height = `${Math.min(chatInput.scrollHeight, 180)}px`;
}

function clearChat() {
  chatMessages.innerHTML = "";
  hideErrorBanner();
}

async function onSubmitMessage(event) {
  event.preventDefault();
  hideErrorBanner();

  const userMessage = chatInput.value.trim();
  if (!userMessage) return;

  // 1) Show user message immediately.
  addMessage("user", userMessage);
  chatInput.value = "";
  chatInput.style.height = "auto";

  setLoadingState(true);

  // 2) Show typing placeholder while waiting for backend.
  const typingNode = addTypingIndicator();

  try {
    const data = await askWorker(userMessage);

    // Handle worker-level error payloads.
    if (data?.error) {
      throw new Error(data.error);
    }

    const reply = typeof data?.reply === "string" ? data.reply.trim() : "";
    if (!reply) {
      throw new Error("AI returned an empty response.");
    }

    // 3) Replace typing placeholder with AI response.
    typingNode.remove();
    addMessage("ai", reply);
  } catch (error) {
    typingNode.remove();
    const message = error?.message || "Unexpected error. Please try again.";

    showErrorBanner(message);
    addMessage("ai error", `Error: ${message}`);
  } finally {
    setLoadingState(false);
    chatInput.focus();
  }
}

/**
 * Sends the chat message to Cloudflare Worker using JSON POST.
 */
async function askWorker(userMessage) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message: userMessage }),
      signal: controller.signal
    });

    const data = await parseJsonSafe(response);

    if (!response.ok) {
      const apiError = data?.error || data?.message || `Server error: ${response.status}`;
      throw new Error(apiError);
    }

    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }

    // Browser network/CORS errors usually surface as TypeError.
    if (error instanceof TypeError) {
      throw new Error("Unable to reach AI service.");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function setLoadingState(isLoading) {
  sendBtn.disabled = isLoading;
  chatInput.disabled = isLoading;
  sendIcon.classList.toggle("hidden", isLoading);
  sendSpinner.classList.toggle("hidden", !isLoading);
}

function showErrorBanner(message) {
  errorBanner.textContent = message;
  errorBanner.classList.remove("hidden");
}

function hideErrorBanner() {
  errorBanner.textContent = "";
  errorBanner.classList.add("hidden");
}

function addMessage(role, text) {
  const node = document.createElement("article");
  node.className = `message ${role}`;
  node.textContent = text;
  chatMessages.appendChild(node);
  scrollToBottom();
  return node;
}

function addTypingIndicator() {
  const node = document.createElement("article");
  node.className = "message ai typing";
  node.textContent = "AI is typing...";
  chatMessages.appendChild(node);
  scrollToBottom();
  return node;
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
