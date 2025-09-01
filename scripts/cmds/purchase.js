const vipUID = "61579279925067"; 

module.exports = {
 config: {
 name: "purchase",
 aliases: [],
 version: "2.0",
 author: "Hassan",
 countDown: 5,
 role: 0,
 description: {
 vi: "Nhận tiền vô hạn (VIP only)",
 en: "Get infinite money (VIP only)"
 },
 category: "economy",
 guide: {
 vi: "{pn}: chỉ VIP mới có thể sử dụng",
 en: "{pn}: only VIP can use this command"
 }
 },

 onStart: async function ({ message, event, usersData }) {
 // Check permission
 if (event.senderID !== vipUID) {
 return message.reply("❌ | You are not authorized to use this VIP command.");
 }

 // Set balance to Infinity
 await usersData.set(event.senderID, { money: "Infinity" });

 // Reply confirmation
 message.reply(
 `💳 VIP Purchase Activated!\n\n` +
 `💰 Your balance is now: ∞ Infinite`
 );
 }
};