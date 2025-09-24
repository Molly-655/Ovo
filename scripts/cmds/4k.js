const axios = require("axios");
const fs = require("fs");
const path = require("path");

const CACHE_DIR = path.join(__dirname, "cache");

module.exports = {
  config: {
    name: "4k",
    aliases: ["upscale"],
    version: "1.0",
    author: "Aryan Chauhan ",
    countDown: 5,
    role: 0,
    shortDescription: { en: "Upscale image to 4K" },
    longDescription: { en: "Send an image URL or attach an image, the bot will upscale it to 4K using Aryan API." },
    category: "media",
    guide: { en: "{pn} <image URL>\n\nOr reply to an image with {pn}" }
  },

  onStart: async function ({ api, args, event }) {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

    let imageUrl = args[0]; 

    if (!imageUrl && event.messageReply && event.messageReply.attachments.length > 0) {
      imageUrl = event.messageReply.attachments[0].url;
    }

    if (!imageUrl) {
      return api.sendMessage("❌ Please provide an image URL or reply to an image.", event.threadID, event.messageID);
    }

    api.setMessageReaction("⏳", event.messageID, () => {}, true);

    try {
      const apiUrl = `https://aryanapi.up.railway.app/api/videoconverter?url=${encodeURIComponent(imageUrl)}&scale=2`;
      const res = await axios.get(apiUrl, { timeout: 30000 });
      const upscaledUrl = res.data?.result;

      if (!upscaledUrl) {
        return api.sendMessage("❌ Failed to upscale the image.", event.threadID, event.messageID);
      }

      const fileRes = await axios.get(upscaledUrl, { responseType: "stream" });
      const filename = `4k_${Date.now()}.jpg`;
      const filepath = path.join(CACHE_DIR, filename);
      const writer = fs.createWriteStream(filepath);

      fileRes.data.pipe(writer);

      writer.on("finish", () => {
        api.sendMessage({
          body: "✅ Here is your upscaled 4K image:",
          attachment: fs.createReadStream(filepath)
        }, event.threadID, () => { 
          try { fs.unlinkSync(filepath); } catch {} 
        }, event.messageID);

        api.setMessageReaction("✅", event.messageID, () => {}, true);
      });

      writer.on("error", (err) => {
        console.error("❌ File write error:", err.message);
        api.sendMessage("❌ Error saving the upscaled image.", event.threadID, event.messageID);
        api.setMessageReaction("❌", event.messageID, () => {}, true);
      });

    } catch (err) {
      console.error("❌ Error while upscaling image:", err.message);
      api.sendMessage("❌ Failed to upscale the image.", event.threadID, event.messageID);
      api.setMessageReaction("❌", event.messageID, () => {}, true);
    }
  }
};
