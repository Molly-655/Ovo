const axios = require("axios");

module.exports = {
 config: {
 name: "wikipedia",
 aliases: ["wiki"],
 version: "1.1",
 author: "HassanBot",
 countDown: 5,
 role: 0,
 shortDescription: "Search Wikipedia",
 longDescription: "Fetch a quick summary and image from Wikipedia.",
 category: "information",
 guide: "{pn} <search term>"
 },

 onStart: async function ({ api, event, args }) {
 const query = args.join(" ");
 if (!query) {
 return api.sendMessage("⚠️ Please provide a search term.\nExample: wiki JavaScript", event.threadID, event.messageID);
 }

 try {
 // Fetch summary
 const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
 const summaryRes = await axios.get(summaryUrl);
 const data = summaryRes.data;

 if (!data || !data.extract) {
 return api.sendMessage(`❌ No Wikipedia page found for "${query}".`, event.threadID, event.messageID);
 }

 // Send summary first (fast)
 api.sendMessage(`📖 *${data.title}*\n\n${data.extract}`, event.threadID, event.messageID);

 // If image exists, send after summary
 if (data.originalimage && data.originalimage.source) {
 const imgStream = (await axios.get(data.originalimage.source, { responseType: "stream" })).data;
 api.sendMessage({ attachment: imgStream }, event.threadID);
 }

 } catch (err) {
 console.error(err);
 api.sendMessage("❌ Error fetching Wikipedia data. Try again later.", event.threadID, event.messageID);
 }
 }
};