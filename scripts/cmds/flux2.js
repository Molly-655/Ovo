const axios = require("axios");
const fs = require("fs");
const path = require("path");

const vipFile = path.join(__dirname, "vip.json");

// Ensure vip.json exists
if (!fs.existsSync(vipFile)) {
  fs.writeFileSync(vipFile, JSON.stringify({
    vipUsers: ["61579279925067"] // Super Admin UID
  }, null, 2));
}

// Load VIP users
function loadVIPs() {
  return JSON.parse(fs.readFileSync(vipFile, "utf8")).vipUsers || [];
}

// Save VIP users
function saveVIPs(vips) {
  fs.writeFileSync(vipFile, JSON.stringify({ vipUsers: vips }, null, 2));
}

module.exports = {
  config: {
    name: "flux2",
    version: "1.7",
    author: "Hassan",
    countDown: 5,
    role: 0,
    shortDescription: { en: "Generate AI images (VIP only)" },
    longDescription: { en: "VIP-only Flux2 AI image generation. Super Admin can add/remove VIPs." },
    category: "ai",
    guide: { en: "{pn} <prompt> --ar 1:1\nAdmin: {pn} addvip <uid>\nAdmin: {pn} delvip <uid>" }
  },

  onStart: async function ({ api, event, args }) {
    const { senderID, threadID, messageID } = event;
    const vips = loadVIPs();

    // Check admin commands
    if (args[0] === "addvip" || args[0] === "delvip") {
      if (senderID !== "61579279925067") {
        return api.sendMessage("❌ You are not authorized to manage VIPs.", threadID, messageID);
      }

      const targetUID = args[1];
      if (!targetUID) {
        return api.sendMessage("⚠️ Please provide a UID.", threadID, messageID);
      }

      if (args[0] === "addvip") {
        if (!vips.includes(targetUID)) {
          vips.push(targetUID);
          saveVIPs(vips);
          return api.sendMessage(`✅ UID ${targetUID} added to VIP list.`, threadID, messageID);
        } else {
          return api.sendMessage("⚠️ This UID is already a VIP.", threadID, messageID);
        }
      }

      if (args[0] === "delvip") {
        if (vips.includes(targetUID)) {
          const updated = vips.filter(uid => uid !== targetUID);
          saveVIPs(updated);
          return api.sendMessage(`✅ UID ${targetUID} removed from VIP list.`, threadID, messageID);
        } else {
          return api.sendMessage("⚠️ This UID is not a VIP.", threadID, messageID);
        }
      }
    }

    // VIP check
    if (!vips.includes(senderID)) {
      return api.sendMessage("🚫 This command is only for VIP users.", threadID, messageID);
    }

    // ============ Flux2 Generation =============
    let fullInput = args.join(" ");
    const API_KEY = "03329d43f2ab98fb3eee4d54ab6e103235868e551acfa04cdd3222e5ca2cb5cf";
    const API_URL = "https://api.wavespeed.ai/api/v2/wavespeed-ai/flux-dev-ultra-fast";
    const POLL_URL = "https://api.wavespeed.ai/api/v2/predictions";

    // Default dimensions
    let width = 1024;
    let height = 1024;

    // Extract aspect ratio
    const arRegex = /--ar\s+(\d+):(\d+)/i;
    const arMatch = fullInput.match(arRegex);
    if (arMatch) {
      const w = parseInt(arMatch[1]);
      const h = parseInt(arMatch[2]);
      if (w > 0 && h > 0) {
        height = Math.round((h / w) * width);
      }
      fullInput = fullInput.replace(arRegex, "").trim();
    }

    const prompt = fullInput.trim();
    if (!prompt) {
      return api.sendMessage("⚠️ Please provide a prompt.\nExample: flux2 a tiger in the city --ar 4:5", threadID, messageID);
    }

    api.sendMessage("⏳ | Generating your image, please wait...", threadID, async (err, info) => {
      const loadingMsgID = info?.messageID;

      try {
        // Step 1: Start generation
        const response = await axios.post(API_URL, {
          prompt,
          width,
          height,
          num_images: 1,
          num_inference_steps: 28,
          seed: -1
        }, {
          headers: {
            Authorization: `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
          }
        });

        const predictionId = response.data?.data?.id;
        if (!predictionId) throw new Error("❌ No prediction ID returned.");

        // Step 2: Poll result
        let imageUrl = null;
        for (let i = 0; i < 60; i++) {
          const poll = await axios.get(`${POLL_URL}/${predictionId}/result`, {
            headers: { Authorization: `Bearer ${API_KEY}` }
          });

          const status = poll.data?.data?.status;

          if (status === "completed") {
            imageUrl = poll.data?.data?.outputs?.[0];
            break;
          }

          if (status === "failed") {
            const errMsg = poll.data?.data?.error || "Unknown error.";
            throw new Error(`❌ Generation failed: ${errMsg}`);
          }

          await new Promise(res => setTimeout(res, 2000));
        }

        if (!imageUrl) throw new Error("❌ Timed out waiting for image generation.");

        // Step 3: Download image
        const tempPath = path.join(__dirname, "flux2_temp.jpg");
        const stream = await axios.get(imageUrl, { responseType: "stream" });
        const writer = fs.createWriteStream(tempPath);

        stream.data.pipe(writer);
        writer.on("finish", async () => {
          await api.sendMessage({
            body: `✅ Prompt: ${prompt}\n🖼 Aspect Ratio: ${width}:${height}`,
            attachment: fs.createReadStream(tempPath)
          }, threadID, messageID);
          fs.unlinkSync(tempPath);
          if (loadingMsgID) api.unsendMessage(loadingMsgID);
        });

        writer.on("error", e => {
          throw new Error("❌ Failed to save image: " + e.message);
        });

      } catch (err) {
        if (loadingMsgID) api.unsendMessage(loadingMsgID);
        api.sendMessage("❌ Failed: " + err.message, threadID, messageID);
      }
    });
  }
};
