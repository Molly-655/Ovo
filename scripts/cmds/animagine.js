const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports = {
  config: {
    name: "animagine",
    aliases: ["xl31"],
    version: "1.1",
    author: "Aryan Chauhan",
    countDown: 5,
    role: 0,
    shortDescription: "Generate anime images.",
    longDescription: "Creates Anime images using AnimegenXl3.1 API",
    category: "ai",
    guide: {
      en: "{pn} <prompt> [--ar=1:1]\nExample: {pn} cute girl --ar=16:9"
    }
  },

  onStart: async function ({ api, event, args }) {
    if (!args[0]) {
      return api.sendMessage(
        "⚠️ Please provide a prompt!\nExample: animaginexl cute girl --ar=16:9",
        event.threadID,
        event.messageID
      );
    }

    let ratio = "1:1";
    const ratioArgIndex = args.findIndex(a => a.startsWith("--ar="));
    if (ratioArgIndex !== -1) {
      ratio = args[ratioArgIndex].replace("--ar=", "");
      args.splice(ratioArgIndex, 1); 
    } else {
      const lastArg = args[args.length - 1];
      if (/^\d+:\d+$/.test(lastArg)) {
        ratio = lastArg;
        args.pop();
      }
    }

    const prompt = args.join(" ");
    const tid = event.threadID;
    const filePath = path.join(__dirname, "animaginexl.png");

    api.sendMessage(
      `⏳ Generating your image...\n🎨 Prompt: ${prompt}\n📐 Ratio: ${ratio}`,
      tid,
      async (err, info) => {
        if (err) return;
        const genMsgID = info.messageID;

        try {
          const response = await axios.get(
            `https://aryanapi.vercel.app/api/animaginexl31?prompt=${encodeURIComponent(prompt)}&ratio=${encodeURIComponent(ratio)}`
          );

          const data = response.data;
          if (!data.status || !data.url) {
            api.sendMessage("❌ Failed to generate image.", tid, event.messageID);
            return api.unsendMessage(genMsgID);
          }

          const imageResponse = await axios({
            method: "GET",
            url: data.url,
            responseType: "stream"
          });

          const writer = fs.createWriteStream(filePath);
          imageResponse.data.pipe(writer);

          writer.on("finish", () => {
            api.sendMessage(
              {
                body: `✅ Here is your image.`,
                attachment: fs.createReadStream(filePath)
              },
              tid,
              () => {
                fs.unlinkSync(filePath);
                api.unsendMessage(genMsgID);
              },
              event.messageID
            );
          });

          writer.on("error", () => {
            api.sendMessage("❌ Failed to save image file.", tid, event.messageID);
            api.unsendMessage(genMsgID);
          });

        } catch (err) {
          console.error(err);
          api.sendMessage("❌ Error: Unable to generate image. Please try again later.", tid, event.messageID);
          api.unsendMessage(genMsgID);
        }
      }
    );
  }
};