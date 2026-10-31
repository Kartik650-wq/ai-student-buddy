const input = document.getElementById("input");
const output = document.getElementById("output");
const keyBox = document.getElementById("key");

// Models to try in order. If one is busy, we move to the next.
const MODELS = ["gemini-3.1-flash-lite", "gemini-3-flash", "gemini-3.8-flash"];

const NO_MARKDOWN = " Do not use markdown or asterisks; write plain text only.";

const PROMPTS = {
  explain:
    "You are a friendly tutor. Explain the following in simple language a high-school student would understand. Use one short analogy." + NO_MARKDOWN,
  summarize:
   "Summarize the following in 3-5 short bullet points. Keep only the key ideas." + NO_MARKDOWN,
  quiz:
    "Write 3 multiple-choice questions to test understanding of the following. Put the answers at the end under 'Answers:'." + NO_MARKDOWN
};

chrome.storage.local.get("apiKey", ({ apiKey }) => {
  if (apiKey) keyBox.value = apiKey;
});

document.getElementById("saveKey").onclick = () => {
  chrome.storage.local.set({ apiKey: keyBox.value.trim() });
  output.textContent = "Key saved.";
};

document.getElementById("grab").onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const [res] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.getSelection().toString()
  });
  input.value = res.result || "";
  if (!res.result) output.textContent = "No text selected on the page.";
};

document.querySelectorAll(".modes button").forEach((btn) => {
  btn.onclick = () => ask(btn.dataset.mode);
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ask(mode) {
  const text = input.value.trim();
  const { apiKey } = await chrome.storage.local.get("apiKey");
  if (!text) return (output.textContent = "Add some text first.");
  if (!apiKey) return (output.textContent = "Add your API key below first.");

  output.textContent = "Thinking...";
  let lastError = "";

  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey
            },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: PROMPTS[mode] }] },
              contents: [{ parts: [{ text }] }]
            })
          }
        );
        const data = await res.json();

        if (res.ok) {
          output.textContent = data.candidates[0].content.parts[0].text;
          return;
        }

        lastError = data.error?.message || "Request failed";
        const busy = res.status === 503 || res.status === 429;
        if (!busy) break; // not a busy error: move to the next model
        output.textContent = "Server busy, retrying...";
        await sleep(2000);
      } catch (err) {
        lastError = err.message;
        break;
      }
    }
  }

  output.textContent = "Error: " + lastError;
}
