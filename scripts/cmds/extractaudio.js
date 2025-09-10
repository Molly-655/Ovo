const axios = require("axios");
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");

module.exports = {
 config: {
 name: "extractaudio",
 aliases: ["audiototext", "transcribe"],
 version: "1.0",
 author: "Hassan",
 description: "Transcribe audio using AssemblyAI",
 commandCategory: "tools",
 usages: "Reply to an audio/voice message",
 cooldowns: 5,
 usePrefix: true
 },

 run: async function ({ api, event }) {
 const ASSEMBLY_API_KEY = "b57ce6d3b91248e380596837be933d0f";

 try {
 const reply = event.messageReply;

 if (
 !reply?.attachments[0]?.url ||
 !["audio", "audio_message"].includes(reply.attachments[0].type)
 ) {
 return api.sendMessage("🎧 Please reply to a voice/audio message to transcribe it.", event.threadID, event.messageID);
 }

 const audioUrl = reply.attachments[0].url;
 const filePath = path.join(__dirname, "cache", `${event.senderID}_audio.mp3`);
 fs.mkdirSync(path.dirname(filePath), { recursive: true });

 const audioRes = await axios.get(audioUrl, { responseType: "stream" });
 const writer = fs.createWriteStream(filePath);
 audioRes.data.pipe(writer);

 writer.on("finish", async () => {
 try {
 // Step 1: Upload audio file to AssemblyAI
 const audioData = fs.readFileSync(filePath);
 const uploadRes = await axios.post(
 "https://api.assemblyai.com/v2/upload",
 audioData,
 {
 headers: {
 authorization: ASSEMBLY_API_KEY,
 "content-type": "application/octet-stream"
 }
 }
 );

 const uploadUrl = uploadRes.data.upload_url;

 // Step 2: Request transcription
 const transcriptRes = await axios.post(
 "https://api.assemblyai.com/v2/transcript",
 {
 audio_url: uploadUrl
 },
 {
 headers: {
 authorization: ASSEMBLY_API_KEY,
 "content-type": "application/json"
 }
 }
 );

 const transcriptId = transcriptRes.data.id;

 // Step 3: Poll for transcription result
 let completed = false;
 let transcriptText = "";

 api.sendMessage("📝 Transcribing audio, please wait...", event.threadID);

 for (let i = 0; i < 20; i++) {
 const pollRes = await axios.get(
 `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
 {
 headers: {
 authorization: ASSEMBLY_API_KEY
 }
 }
 );

 if (pollRes.data.status === "completed") {
 transcriptText = pollRes.data.text;
 completed = true;
 break;
 }

 await new Promise(resolve => setTimeout(resolve, 3000)); // wait 3s
 }

 fs.unlinkSync(filePath);

 if (completed) {
 api.sendMessage(`🗣 Transcription:\n\n${transcriptText}`, event.threadID, event.messageID);
 } else {
 api.sendMessage("⌛ Transcription took too long or failed. Try again later.", event.threadID, event.messageID);
 }

 } catch (err) {
 console.error("AssemblyAI Error:", err.response?.data || err.message);
 api.sendMessage("❌ Failed to transcribe the audio.", event.threadID, event.messageID);
 }
 });

 writer.on("error", () => {
 api.sendMessage("❌ Failed to download the audio file.", event.threadID, event.messageID);
 });

 } catch (err) {
 console.error("Transcribe Command Error:", err.message);
 api.sendMessage("⚠ An error occurred while processing the audio.", event.threadID, event.messageID);
 }
 }
};