const fs = require("fs-extra");
const { utils } = global;

module.exports = {
  config: {
    name: "prefix",
    version: "2.0",
    author: "Hassan",
    countDown: 5,
    role: 0,
    shortDescription: "Change or view prefix",
    longDescription: "Change the command prefix for your box chat or for the whole system (admins only).",
    category: "system",
    guide: {
      en: `
        {pn} <new prefix>        → Change prefix in this chat
        {pn} <new prefix> -g     → Change global prefix (admins only)
        {pn} reset               → Reset prefix in this chat to default
        {pn}                     → Show current prefixes
      `
    }
  },

  langs: {
    en: {
      reset: "✅ Prefix reset to default: %1",
      onlyAdmin: "❌ Only bot admins can change the system prefix.",
      confirmGlobal: "⚠️ React to confirm changing the **system prefix** to: %1",
      confirmThread: "⚠️ React to confirm changing the **chat prefix** to: %1",
      successGlobal: "🌐 System prefix changed to: %1",
      successThread: "🛸 Chat prefix changed to: %1",
      show: "🌐 System prefix: %1\n🛸 Chat prefix: %2"
    }
  },

  onStart: async function ({ message, role, args, event, threadsData, getLang }) {
    const sysPrefix = global.GoatBot.config.prefix;
    const chatPrefix = await utils.getPrefix(event.threadID);

    // no args → show current prefixes
    if (!args[0]) {
      return message.reply(getLang("show", sysPrefix, chatPrefix));
    }

    // reset prefix in this chat
    if (args[0].toLowerCase() === "reset") {
      await threadsData.set(event.threadID, null, "data.prefix");
      return message.reply(getLang("reset", sysPrefix));
    }

    const newPrefix = args[0];
    const isGlobal = args[1] === "-g";

    if (isGlobal) {
      if (role < 2) return message.reply(getLang("onlyAdmin"));
      return message.reply(getLang("confirmGlobal", newPrefix), (err, info) => {
        global.GoatBot.onReaction.set(info.messageID, {
          type: "global",
          author: event.senderID,
          newPrefix
        });
      });
    }

    return message.reply(getLang("confirmThread", newPrefix), (err, info) => {
      global.GoatBot.onReaction.set(info.messageID, {
        type: "thread",
        author: event.senderID,
        newPrefix,
        threadID: event.threadID
      });
    });
  },

  onReaction: async function ({ message, event, Reaction, threadsData, getLang }) {
    if (event.userID !== Reaction.author) return;

    if (Reaction.type === "global") {
      global.GoatBot.config.prefix = Reaction.newPrefix;
      fs.writeFileSync(global.client.dirConfig, JSON.stringify(global.GoatBot.config, null, 2));
      return message.reply(getLang("successGlobal", Reaction.newPrefix));
    }

    if (Reaction.type === "thread") {
      await threadsData.set(Reaction.threadID, Reaction.newPrefix, "data.prefix");
      return message.reply(getLang("successThread", Reaction.newPrefix));
    }
  }
};
