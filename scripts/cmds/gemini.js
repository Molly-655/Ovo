const axios = require("axios");
const { get } = require("https");

const API_KEY = "AIzaSyDooSt0eBw9i49S9_kQAVUDAgEm4CmaR2c";
const API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

if (!global.client) global.client = {};
if (!global.client.geminiChats) global.client.geminiChats = new Map();

module.exports = {
 config: {
 name: "gemini",
 aliases: ["g"],
 version: "3.2",
 author: "Hassan",
 countDown: 5,
 role: 0,
 shortDescription: "Chat with Gemini AI (text or image)",
 longDescription: "Chat with Gemini AI. Supports replying to images with questions.",
 category: "ai",
 guide: "{pn} [text]\nReply to image or text to continue the chat.\nUse: {pn} clear — to reset chat."
 },

 onStart: async function ({ api, event, args, message }) {
 const { threadID, senderID, messageReply } = event;
 const prompt = args.join(" ").trim();
 const chatKey = `${threadID}_${senderID}`;

 if (prompt.toLowerCase() === "clear") {
 global.client.geminiChats.delete(chatKey);
 return message.reply("🧹 Gemini chat history cleared.");
 }

 if (!global.client.geminiChats.has(chatKey)) {
 global.client.geminiChats.set(chatKey, []);
 }

 const chatHistory = global.client.geminiChats.get(chatKey);

 // Detect image reply
 if (messageReply?.attachments?.[0]?.type === "photo") {
 const imageUrl = messageReply.attachments[0].url;
 const base64Image = await downloadImageAsBase64(imageUrl);
 if (!base64Image) return message.reply("❌ Unable to process the image.");

 const request = {
 contents: [
 {
 role: "user",
 parts: [
 {
 inlineData: {
 mimeType: "image/jpeg",
 data: base64Image
 }
 },
 {
 text: prompt || "What's in this image?"
 }
 ]
 }
 ],
 generationConfig: {
 maxOutputTokens: 800
 }
 };

 const reply = await queryGemini(request);
 return api.sendMessage(reply, threadID, (err, info) => {
 if (!err) {
 global.api.handleReply.set(info.messageID, {
 name: "gemini",
 author: senderID,
 threadID,
 chatKey
 });
 }
 }, event.messageID);
 }

 // Normal text input
 if (prompt) {
 chatHistory.push({ role: "user", parts: [{ text: prompt }] });
 }

 const request = {
 contents: chatHistory,
 generationConfig: {
 maxOutputTokens: 800
 }
 };

 const reply = await queryGemini(request);
 chatHistory.push({ role: "model", parts: [{ text: reply }] });

 api.sendMessage(reply, threadID, (err, info) => {
 if (!err) {
 global.api.handleReply.set(info.messageID, {
 name: "gemini",
 author: senderID,
 threadID,
 chatKey
 });
 }
 }, event.messageID);
 },

 onReply: async function ({ api, event, message, Reply }) {
 const { threadID, senderID, body, messageReply } = event;
 const chatKey = Reply.chatKey;

 if (senderID !== Reply.author) {
 return message.reply("❌ Only the original user can continue this Gemini chat.");
 }

 if (!global.client.geminiChats.has(chatKey)) {
 global.client.geminiChats.set(chatKey, []);
 }

 const chatHistory = global.client.geminiChats.get(chatKey);

 // If reply includes an image
 if (messageReply?.attachments?.[0]?.type === "photo") {
 const imageUrl = messageReply.attachments[0].url;
 const base64Image = await downloadImageAsBase64(imageUrl);
 if (!base64Image) return message.reply("❌ Unable to load image.");

 const request = {
 contents: [
 {
 role: "user",
 parts: [
 {
 inlineData: {
 mimeType: "image/jpeg",
 data: base64Image
 }
 },
 {
 text: body || "What is in this image?"
 }
 ]
 }
 ],
 generationConfig: {
 maxOutputTokens: 800
 }
 };

 const reply = await queryGemini(request);

 return api.sendMessage(reply, threadID, (err, info) => {
 if (!err) {
 global.api.handleReply.set(info.messageID, {
 name: "gemini",
 author: senderID,
 threadID,
 chatKey
 });
 }
 }, event.messageID);
 }

 // Normal text reply
 chatHistory.push({ role: "user", parts: [{ text: body }] });

 const request = {
 contents: chatHistory,
 generationConfig: {
 maxOutputTokens: 800
 }
 };

 const reply = await queryGemini(request);
 chatHistory.push({ role: "model", parts: [{ text: reply }] });

 api.sendMessage(reply, threadID, (err, info) => {
 if (!err) {
 global.api.handleReply.set(info.messageID, {
 name: "gemini",
 author: senderID,
 threadID,
 chatKey
 });
 }
 }, event.messageID);
 }
};

// Query Gemini
async function queryGemini(body) {
 try {
 const res = await axios.post(API_URL, body, {
 headers: {
 "Content-Type": "application/json"
 }
 });

 return res.data?.candidates?.[0]?.content?.parts?.[0]?.text || "⚠️ Gemini didn't return a reply.";
 } catch (err) {
 console.error("Gemini API error:", err.response?.data || err.message);
 return "❌ Gemini API error occurred.";
 }
}

// Convert image URL to base64
function downloadImageAsBase64(url) {
 return new Promise((resolve, reject) => {
 get(url, res => {
 const data = [];
 res.on("data", chunk => data.push(chunk));
 res.on("end", () => {
 const buffer = Buffer.concat(data);
 resolve(buffer.toString("base64"));
 });
 }).on("error", err => {
 console.error("Image download error:", err.message);
 resolve(null);
 });
 });
}