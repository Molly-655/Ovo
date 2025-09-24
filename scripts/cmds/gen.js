const axios = require("axios");
const fs = require("fs");
const path = require("path");

const CACHE_DIR = path.join(__dirname, "cache");

module.exports = {
  config: {
    name: "gen",
    aliases: ["ai4image"],
    version: "1.1",
    author: "Aryan Chauhan",
    countDown: 5,
    role: 0,
    shortDescription: { en: "Generate AI images using Gen AI" },
    longDescription: { en: "Send a text prompt and optionally an aspect ratio to generate an AI image using Aryan AI4Image API." },
    category: "ai",
    guide: { en: "{pn} <prompt> [--ar=1:1]\n\nExample:\n{pn} cute cat in a garden --ar=16:9" }
  },

  onStart: async function ({ api, args, event }) {
    if (!args[0]) return api.sendMessage("❌ Please provide a prompt for Gen AI.", event.threadID, event.messageID);

    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

    let ratio = "1:1";
    const argStr = args.join(" ");

    const arMatch = argStr.match(/--?ar[=\s]+([0-9]+:[0-9]+)/i);
    if (arMatch) ratio = arMatch[1];

    const prompt = argStr.replace(/--?ar[=\s]+([0-9]+:[0-9]+)/i, "").trim();

    if (!prompt) return api.sendMessage("❌ Please provide a valid prompt.", event.threadID, event.messageID);

    api.setMessageReaction("⏳", event.messageID, () => {}, true);

    try {
      const apiUrl = `https://aryanapi.up.railway.app/api/ai4image?prompt=${encodeURIComponent(prompt)}&ratio=${encodeURIComponent(ratio)}`;
      const res = await axios.get(apiUrl, { timeout: 30000 });
      const imageUrl = res.data?.result?.image_link;

      if (!imageUrl) {
        return api.sendMessage("❌ Failed to generate Gen AI image.", event.threadID, event.messageID);
      }

      const fileRes = await axios.get(imageUrl, { responseType: "stream" });
      const filename = `genai_${Date.now()}.jpeg`;
      const filepath = path.join(CACHE_DIR, filename);
      const writer = fs.createWriteStream(filepath);

      fileRes.data.pipe(writer);

      writer.on("finish", () => {
        api.sendMessage({
          body: `✨ Gen AI image generated for prompt: "${prompt}"\n📐 Ratio: ${ratio}`,
          attachment: fs.createReadStream(filepath)
        }, event.threadID, () => { 
          try { fs.unlinkSync(filepath); } catch {} 
        }, event.messageID);

        api.setMessageReaction("✅", event.messageID, () => {}, true);
      });

      writer.on("error", (err) => {
        console.error("❌ File write error:", err.message);
        api.sendMessage("❌ Error saving the Gen AI image.", event.threadID, event.messageID);
        api.setMessageReaction("❌", event.messageID, () => {}, true);
      });

    } catch (err) {
      console.error("❌ Error generating Gen AI image:", err.message);
      api.sendMessage("❌ Failed to generate Gen AI image.", event.threadID, event.messageID);
      api.setMessageReaction("❌", event.messageID, () => {}, true);
    }
  }
};
