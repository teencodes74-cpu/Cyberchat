const WORKER_URL = "https://cyberchat.teencodes74.workers.dev";

const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const clearChatBtn = document.getElementById("clearChatBtn");
const spinner = sendBtn.querySelector(".spinner");
const btnText = sendBtn.querySelector(".btn-text");

addMessage("ai", "Hi! I'm CyberChat. Ask me anything.");

messageInput.addEventListener("input", autoResizeTextarea);
messageInput.addEventListener("keydown", handleEnterToSend);
clearChatBtn.addEventListener("click", handleClearChat);
chatForm.addEventListener("submit", handleChatSubmit);

function autoResizeTextarea() {
  messageInput.style.height = "auto";
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 180)}px`;
}

function handleEnterToSend(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
}

function handleClearChat() {
  chatWindow.innerHTML = "";
  addMessage("ai", "Chat cleared. Ready for your next question.");
}

async function handleChatSubmit(event) {
  event.preventDefault();

  const userMessage = messageInput.value.trim();
  if (!userMessage) {
    return;
  }

  addMessage("user", userMessage);
  messageInput.value = "";
  messageInput.style.height = "auto";

  setLoading(true);

  // Show an AI typing placeholder while waiting for the backend reply.
  const typingPlaceholder = addTypingIndicator();

  try {
    const aiReply = await askAI(userMessage);

    // Replace placeholder with final AI response.
    typingPlaceholder.remove();
    await addMessageWithTyping("ai", aiReply);
  } catch (error) {
    typingPlaceholder.remove();
    addMessage("ai error", `Error: ${error.message}`);
  } finally {
    setLoading(false);
    messageInput.focus();
  }
}

/**
 * Sends a single chat message to the Cloudflare Worker backend.
 *
 * Example fetch usage:
 * fetch("https://cyberchat.teencodes74.workers.dev", {
 *   method: "POST",
 *   headers: { "Content-Type": "application/json" },
 *   body: JSON.stringify({ message: "Hello!" })
 * });
 */
async function askAI(message) {
  const response = await fetch(WORKER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message })
  });

  const data = await parseJsonSafely(response);

  if (!response.ok) {
    const errorMessage = data?.error || data?.message || `Request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  const reply = extractReplyText(data);
  if (!reply) {
    throw new Error("The AI returned an empty response.");
  }

  return reply;
}

function extractReplyText(payload) {
  if (typeof payload === "string") {
    return payload.trim();
  }

  if (typeof payload?.reply === "string") {
    return payload.reply.trim();
  }

  if (typeof payload?.response === "string") {
    return payload.response.trim();
  }

  if (typeof payload?.text === "string") {
    return payload.text.trim();
  }

  return "";
}

function setLoading(isLoading) {
  sendBtn.disabled = isLoading;
  spinner.classList.toggle("hidden", !isLoading);
  btnText.textContent = isLoading ? "Thinking" : "Send";
}

function addMessage(role, text) {
  const messageElement = document.createElement("div");
  messageElement.className = `message ${role}`;
  messageElement.textContent = text;
  chatWindow.appendChild(messageElement);
  scrollToBottom();
  return messageElement;
}

async function addMessageWithTyping(role, text) {
  const messageElement = addMessage(role, "");

  for (let i = 0; i < text.length; i += 1) {
    messageElement.textContent += text[i];

    if (i % 3 === 0) {
      scrollToBottom();
      await wait(8);
    }
  }

  scrollToBottom();
}

function addTypingIndicator() {
  const typingElement = document.createElement("div");
  typingElement.className = "message ai";
  typingElement.innerHTML =
    '<span class="typing-dots" aria-label="CyberChat is typing"><span></span><span></span><span></span></span>';

  chatWindow.appendChild(typingElement);
  scrollToBottom();
  return typingElement;
}

async function parseJsonSafely(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function scrollToBottom() {
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
