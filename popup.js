const input = document.getElementById("input");
const output = document.getElementById("output");
const keyBox = document.getElementById("key");

const PROMPTS = {
  explain:
    "You are a friendly tutor. Explain the following in simple language a high-school student would understand. Use one short analogy. Do not use markdown or asterisks; write plain text only..",
  summarize:
    "Summarize the following in 3-5 short bullet points. Keep only the key ideas.Do not use markdown or asterisks; write plain text only.",
  quiz:
    "Write 3 multiple-choice questions to test understanding of the following. Put the answers at the end under 'Answers:'.Do not use markdown or asterisks; write plain text only."
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

async function ask(mode) {
  const text = input.value.trim();
  const { apiKey } = await chrome.storage.local.get("apiKey");
  if (!text) return (output.textContent = "Add some text first.");
  if (!apiKey) return (output.textContent = "Add your API key below first.");

  output.textContent = "Thinking...";
  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent",
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
    if (!res.ok) throw new Error(data.error?.message || "Request failed");
    output.textContent = data.candidates[0].content.parts[0].text;
  } catch (err) {
    output.textContent = "Error: " + err.message;
  }
}