const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports = {
 config: {
 name: "flux2",
 version: "1.6",
 author: "Hassan",
 countDown: 5,
 role: 0,
 shortDescription: { en: "Generate AI images using Flux2" },
 longDescription: { en: "Use Flux Dev Ultra Fast to generate images with prompts and aspect ratio." },
 category: "ai",
 guide: { en: "{pn} <prompt> --ar 1:1\nExample: ?flux2 a robot in the city --ar 16:9" }
 },

 onStart: async function ({ api, event, args }) {
 let fullInput = args.join(" ");
 const API_KEY = "eb4f0c2148d5de30ffac5b576668f365ca77f0cefb6fc63b3b83f29e3d8fa16f"; // Replace with your actual API key
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
 fullInput = fullInput.replace(arRegex, "").trim(); // Remove --ar from prompt
 }

 const prompt = fullInput.trim();
 if (!prompt) {
 return api.sendMessage("⚠️ Please provide a prompt.\nExample: flux2 a tiger in the city --ar 4:5", event.threadID, event.messageID);
 }

 // Send loading message
 api.sendMessage("⏳ | Generating your image, please wait...", event.threadID, async (err, info) => {
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
 }, event.threadID, event.messageID);
 fs.unlinkSync(tempPath);
 if (loadingMsgID) api.unsendMessage(loadingMsgID);
 });

 writer.on("error", e => {
 throw new Error("❌ Failed to save image: " + e.message);
 });

 } catch (err) {
 if (loadingMsgID) api.unsendMessage(loadingMsgID);
 api.sendMessage("❌ Failed: " + err.message, event.threadID, event.messageID);
 }
 });
 }
};