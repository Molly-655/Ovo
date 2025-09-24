const axios = require("axios");
const fs = require("fs");
const path = require("path");

const CACHE_DIR = path.join(__dirname, "cache");

module.exports = {
  config: {
    name: "deepimage",
    version: "1.0",
    author: "Aryan Chauhan",
    countDown: 5,
    role: 0,
    shortDescription: { en: "Generate AI images using DeepImage" },
    longDescription: { en: "Send a prompt and the bot will generate a DeepImage AI image using Aryan API." },
    category: "ai",
    guide: { en: "{pn} <prompt> [--v=2]\n\nExample:\n{pn} fantasy castle --v=2" }
  },

  onStart: async function ({ api, args, event }) {
    if (!args[0]) return api.sendMessage("❌ Please provide a prompt for DeepImage.", event.threadID, event.messageID);

    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

    const argStr = args.join(" ");

    let version = "2";
    const versionMatch = argStr.match(/--?v[=\s]+([0-9]+)/i);
    if (versionMatch) version = versionMatch[1];

    const prompt = argStr.replace(/--?v[=\s]+([0-9]+)/i, "").trim();

    if (!prompt) return api.sendMessage("❌ Please provide a valid prompt.", event.threadID, event.messageID);

    api.setMessageReaction("⏳", event.messageID, () => {}, true);

    try {
      const apiUrl = `https://aryanapi.up.railway.app/api/deepimage?prompt=${encodeURIComponent(prompt)}&version=${version}`;
      const res = await axios.get(apiUrl, { timeout: 30000 });

      const imageUrl = res.data?.data?.output_url;

      if (!imageUrl) return api.sendMessage("❌ Failed to generate DeepImage AI image.", event.threadID, event.messageID);

      const fileRes = await axios.get(imageUrl, { responseType: "stream" });
      const filename = `deepimage_${Date.now()}.jpg`;
      const filepath = path.join(CACHE_DIR, filename);
      const writer = fs.createWriteStream(filepath);

      fileRes.data.pipe(writer);

      writer.on("finish", () => {
        api.sendMessage({
          body: `✨ DeepImage AI image generated for prompt: "${prompt}"\n🆚 Version: ${version}`,
          attachment: fs.createReadStream(filepath)
        }, event.threadID, () => { 
          try { fs.unlinkSync(filepath); } catch {} 
        }, event.messageID);

        api.setMessageReaction("✅", event.messageID, () => {}, true);
      });

      writer.on("error", (err) => {
        console.error("❌ File write error:", err.message);
        api.sendMessage("❌ Error saving the DeepImage AI image.", event.threadID, event.messageID);
        api.setMessageReaction("❌", event.messageID, () => {}, true);
      });

    } catch (err) {
      console.error("❌ Error generating DeepImage AI image:", err.message);
      api.sendMessage("❌ Failed to generate DeepImage AI image.", event.threadID, event.messageID);
      api.setMessageReaction("❌", event.messageID, () => {}, true);
    }
  }
};
