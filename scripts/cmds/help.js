const fs = require("fs-extra");
const axios = require("axios");
const path = require("path");
const { getPrefix } = global.utils;
const { commands, aliases } = global.GoatBot;

const BOT_BRAND = "【 🤖 TEAM AVA | Hassan's Bot 】";

module.exports = {
  config: {
    name: "help",
    version: "2.0",
    author: "Hassan (AVA Edition)",
    countDown: 5,
    role: 0,
    description: {
      en: "Show list of commands or details of a specific command"
    },
    category: "info",
    guide: {
      en: "{pn} [page]\n{pn} [command]"
    }
  },

  langs: {
    en: {
      listPage: 
`┌─「 ${BOT_BRAND} 」
│ Commands list (Page %1/%2)
│ Total available: %3
│ Prefix: %4
├─────────────────
%5
└─ Type %4help <command> for details`,
      
      listCategory: 
`┌─「 ${BOT_BRAND} 」
│ Grouped commands
│ Total: %1
├─────────────────
%2
└─ Type %3help <command>`,

      notFound: "⚠️ Command '%1' not found.",
      info: 
`┌─「 COMMAND INFO 」
│ Name: %1
│ Description: %2
│ Aliases: %3
│ Local aliases: %4
│ Version: %5
│ Role: %6
│ Cooldown: %7s
│ Author: %8
├─────────────────
Usage:
%9
└─────────────────`,
      onlyUsage: "📘 Usage:\n%1",
      onlyInfo: "ℹ️ Info:\n- Name: %1\n- Description: %2\n- Aliases: %3\n- Version: %4\n- Role: %5",
      onlyAlias: "🔑 Aliases: %1\nLocal aliases: %2",
      onlyRole: "👤 Required role: %1",
      doNotHave: "None",
      roleText0: "0 (All users)",
      roleText1: "1 (Group Admin)",
      roleText2: "2 (Bot Admin)",
      roleText0setRole: "0 (set role, all users)",
      roleText1setRole: "1 (set role, group admins)",
      pageNotFound: "❌ Page %1 does not exist"
    }
  },

  onStart: async function ({ message, args, event, threadsData, getLang, role, globalData }) {
    const langCode = await threadsData.get(event.threadID, "data.lang") || global.GoatBot.config.language;
    const { threadID } = event;
    const prefix = getPrefix(threadID);
    let commandName = (args[0] || "").toLowerCase();

    let command = commands.get(commandName) || commands.get(aliases.get(commandName));

    // Search in custom aliases
    const threadData = await threadsData.get(threadID);
    const aliasesData = threadData.data.aliases || {};
    if (!command) {
      for (const cmdName in aliasesData) {
        if (aliasesData[cmdName].includes(commandName)) {
          command = commands.get(cmdName);
          break;
        }
      }
    }

    // Search in global aliases
    if (!command) {
      const globalAliasesData = await globalData.get('setalias', 'data', []);
      for (const item of globalAliasesData) {
        if (item.aliases.includes(commandName)) {
          command = commands.get(item.commandName);
          break;
        }
      }
    }

    // Show command list
    if (!command && (!args[0] || !isNaN(args[0]))) {
      const arrayInfo = [];
      const page = parseInt(args[0]) || 1;
      const perPage = 20;

      for (const [name, value] of commands) {
        if (value.config.role > 1 && role < value.config.role) continue;
        let desc = checkLangObject(value.config.description, langCode) || "";
        arrayInfo.push(`${name} — ${desc}`);
      }

      arrayInfo.sort();
      const totalPage = Math.ceil(arrayInfo.length / perPage);
      if (page < 1 || page > totalPage) return message.reply(getLang("pageNotFound", page));

      const pageItems = arrayInfo.slice((page - 1) * perPage, page * perPage).join("\n");
      return message.reply(getLang("listPage", page, totalPage, arrayInfo.length, prefix, pageItems));
    }

    // Command not found
    if (!command) return message.reply(getLang("notFound", args[0]));

    // Show command info
    const cfg = command.config;
    const guide = (cfg.guide?.[langCode] || cfg.guide?.en || "").replace(/\{pn\}/g, prefix + cfg.name);

    const aliasesString = cfg.aliases?.join(", ") || getLang("doNotHave");
    const localAlias = threadData.data.aliases?.[cfg.name]?.join(", ") || getLang("doNotHave");
    let roleText = cfg.role === 0 ? getLang("roleText0") : cfg.role === 1 ? getLang("roleText1") : getLang("roleText2");

    if (args[1]?.match(/^-u|usage$/)) {
      return message.reply(getLang("onlyUsage", guide));
    }
    if (args[1]?.match(/^-i|info$/)) {
      return message.reply(getLang("onlyInfo", cfg.name, cfg.description?.en || "", aliasesString, cfg.version, roleText));
    }
    if (args[1]?.match(/^-a|alias$/)) {
      return message.reply(getLang("onlyAlias", aliasesString, localAlias));
    }
    if (args[1]?.match(/^-r|role$/)) {
      return message.reply(getLang("onlyRole", roleText));
    }

    return message.reply(getLang(
      "info",
      cfg.name,
      cfg.description?.en || "",
      aliasesString,
      localAlias,
      cfg.version,
      roleText,
      cfg.countDown || 1,
      cfg.author || "",
      guide
    ));
  }
};

function checkLangObject(data, langCode) {
  if (typeof data == "string") return data;
  if (typeof data == "object" && !Array.isArray(data)) return data[langCode] || data.en || undefined;
  return undefined;
}
