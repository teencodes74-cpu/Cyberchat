// CyberChat frontend talks only to the Cloudflare Worker.
const WORKER_URL = "https://cyberchat.teencodes74.workers.dev/";
const REQUEST_TIMEOUT_MS = 30000;

const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const clearChatBtn = document.getElementById("clearChatBtn");
const errorBanner = document.getElementById("errorBanner");
const spinner = sendBtn.querySelector(".spinner");
const sendIcon = sendBtn.querySelector(".btn-text");

addMessage("ai", "Hello! I’m CyberChat by teencodes. How can I help today?");

chatForm.addEventListener("submit", handleSubmit);
messageInput.addEventListener("keydown", handleEnterToSend);
messageInput.addEventListener("input", autoResizeTextarea);
clearChatBtn.addEventListener("click", clearChat);

function handleEnterToSend(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
}

function autoResizeTextarea() {
  messageInput.style.height = "auto";
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 180)}px`;
}

function clearChat() {
  chatWindow.innerHTML = "";
  hideError();
  addMessage("ai", "Chat cleared. Start a new conversation anytime.");
}

async function handleSubmit(event) {
  event.preventDefault();
  hideError();

  const userInput = messageInput.value.trim();
  if (!userInput) return;

  addMessage("user", userInput);
  messageInput.value = "";
  messageInput.style.height = "auto";

  setLoading(true);
  const typingNode = addTypingIndicator();

  try {
    const reply = await askAI(userInput);
    typingNode.remove();
    await addMessageWithTyping("ai", reply);
  } catch (error) {
    typingNode.remove();
    const message = error?.message || "Unexpected error. Please try again.";
    showError(message);
    addMessage("ai error", `Error: ${message}`);
  } finally {
    setLoading(false);
    messageInput.focus();
  }
}

/**
 * Sends user message to Cloudflare Worker.
 * Payload format required: { message: userInput }
 */
async function askAI(userInput) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(WORKER_URL, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message: userInput }),
      signal: controller.signal
    });

    const payload = await parseJson(response);

    if (!response.ok) {
      const apiError = payload?.error || payload?.message || `Server error: ${response.status}`;
      throw new Error(apiError);
    }

    // Some APIs can return an application-level error even with HTTP 200.
    if (payload?.error) {
      throw new Error(payload.error);
    }

    const reply = extractReply(payload);
    if (!reply) {
      throw new Error("AI returned an empty response.");
    }

    return reply;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }

    // Network/CORS failures in browsers are typically TypeError("Failed to fetch").
    if (error instanceof TypeError) {
      if (!navigator.onLine) {
        throw new Error("You appear to be offline. Check your internet connection.");
      }

      throw new Error(
        "Unable to reach AI service. Please check your network connection or CORS configuration."
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractReply(payload) {
  if (!payload) return "";
  if (typeof payload === "string") return payload.trim();

  // Worker contract: always return { reply: "..." }
  if (typeof payload.reply === "string") return payload.reply.trim();

  // Defensive fallbacks
  if (typeof payload.response === "string") return payload.response.trim();
  if (typeof payload.text === "string") return payload.text.trim();

  return "";
}

async function parseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.classList.remove("hidden");
}

function hideError() {
  errorBanner.classList.add("hidden");
  errorBanner.textContent = "";
}

function setLoading(isLoading) {
  sendBtn.disabled = isLoading;
  spinner.classList.toggle("hidden", !isLoading);
  sendIcon.classList.toggle("hidden", isLoading);
}

function addMessage(role, text) {
  const node = document.createElement("article");
  node.className = `message ${role}`;
  node.textContent = text;
  chatWindow.appendChild(node);
  scrollToBottom();
  return node;
}

function addTypingIndicator() {
  const node = document.createElement("article");
  node.className = "message ai typing";
  node.textContent = "AI is typing...";
  chatWindow.appendChild(node);
  scrollToBottom();
  return node;
}

async function addMessageWithTyping(role, text) {
  const node = addMessage(role, "");
  for (let i = 0; i < text.length; i += 1) {
    node.textContent += text[i];
    if (i % 3 === 0) {
      scrollToBottom();
      await wait(10);
    }
  }
  scrollToBottom();
}

function scrollToBottom() {
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
