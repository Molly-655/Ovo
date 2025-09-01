const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports = {
 config: {
 name: "tiktok",
 aliases: ["tt"],
 version: "1.0",
 author: "Hassan",
 countDown: 5,
 role: 0,
 shortDescription: "Download TikTok video",
 longDescription: "Download TikTok video without watermark",
 category: "media",
 guide: {
 en: "{pn} <tiktok video link>"
 }
 },

 onStart: async function ({ message, args }) {
 const url = args[0];
 if (!url || !url.includes("tiktok.com")) {
 return message.reply("❌ Please provide a valid TikTok link.");
 }

 message.reply("⏳ Downloading TikTok video...");

 const apis = [
 async (link) => {
 const res = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(link)}`);
 return res.data.data?.play || null;
 },
 async (link) => {
 const res = await axios.get(`https://www.tikmate.app/api/lookup?url=${encodeURIComponent(link)}`);
 if (res.data.token && res.data.id) {
 return `https://tikmate.app/download/${res.data.token}/${res.data.id}.mp4`;
 }
 return null;
 },
 async (link) => {
 const res = await axios.get(`https://api.tiklydown.me/api/download?url=${encodeURIComponent(link)}`);
 return res.data?.video?.nowatermark || null;
 }
 ];

 let videoUrl = null;

 for (const getUrl of apis) {
 try {
 videoUrl = await getUrl(url);
 if (videoUrl) break;
 } catch (e) {
 continue;
 }
 }

 if (!videoUrl) {
 return message.reply("⚠️ Error downloading TikTok video. Please try again later.");
 }

 const tempPath = path.join(__dirname, `tiktok_${Date.now()}.mp4`);
 const writer = fs.createWriteStream(tempPath);

 try {
 const response = await axios.get(videoUrl, { responseType: "stream" });
 response.data.pipe(writer);

 writer.on("finish", () => {
 message.reply({
 body: "✅ Here's your TikTok video!",
 attachment: fs.createReadStream(tempPath)
 }, () => fs.unlinkSync(tempPath));
 });

 writer.on("error", () => {
 fs.unlinkSync(tempPath);
 message.reply("❌ Failed to save the video.");
 });

 } catch (err) {
 message.reply("❌ Failed to download the video.");
 }
 }
};