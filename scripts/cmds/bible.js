const axios = require("axios");

module.exports = {
 config: {
 name: "bible",
 aliases: ["verse", "scripture"],
 version: "1.0",
 author: "Hassan",
 countDown: 5,
 role: 0,
 shortDescription: "Fetch a specific Bible verse",
 longDescription: "Get a Bible verse by providing book, chapter, and verse. Example: -bible John 3:16",
 category: "religion",
 guide: {
 en: "{pn} <Book> <Chapter:Verse>\nExample: {pn} John 3:16"
 }
 },

 onStart: async function ({ api, event, args }) {
 if (args.length === 0) {
 return api.sendMessage(
 "📖 Please provide a book, chapter, and verse.\nExample: -bible John 3:16",
 event.threadID,
 event.messageID
 );
 }

 try {
 const query = args.join(" ");
 const url = `https://bible-api.com/${encodeURIComponent(query)}`;
 const res = await axios.get(url);

 if (!res.data || !res.data.text) {
 return api.sendMessage("❌ Verse not found. Please check your input.", event.threadID, event.messageID);
 }

 const verse = res.data;
 const message = `📖 *${verse.reference}*\n\n${verse.text}\n\n📚 Version: ${verse.translation_name}`;

 api.sendMessage(message, event.threadID, event.messageID);
 } catch (e) {
 console.error(e);
 api.sendMessage("❌ Failed to fetch verse. Please try again later.", event.threadID, event.messageID);
 }
 }
};