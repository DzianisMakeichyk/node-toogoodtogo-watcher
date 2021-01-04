const _ = require("lodash");
const Telegraf = require("telegraf");
const { config } = require("./config");
const { BehaviorSubject } = require("rxjs");
const { map, distinctUntilChanged } = require("rxjs/operators");
const moment = require("moment");

const numberOfActiveChats$ = new BehaviorSubject(getNumberOfActiveChats());
const cache = {};
const bot = createBot();

module.exports = {
  hasActiveChats$,
  notify,
};

function cal(m) {
  return m.calendar(null, {
    lastDay: "[Yesterday] HH:mm",
    sameDay: "[Today] HH:mm",
    nextDay: "[Morning] HH:mm",
    lastWeek: "[Last] dddd HH:mm",
    nextWeek: "dddd HH:mm",
    sameElse: "L",
  });
}

function formatInterval(business) {
  if (business.pickup_interval) {
    const startDate = moment(
      new Date(Date.parse(business.pickup_interval.start))
    );
    const endDate = moment(new Date(Date.parse(business.pickup_interval.end)));

    return `${cal(startDate)} - ${cal(endDate)}`;
  }
  return "?";
}

function formatMessage(businesses) {
  return businesses.map(
    (business) => `
🔥${business.display_name}🔥
<a href="${business.item.logo_picture.current_url}">&#8205;</a>
⏰ ${formatInterval(business)}
🥡 <b>${business.items_available}</b>
-----------------------------------
<a href="https://share.toogoodtogo.com/item/${business.item.item_id}">🍽 <b>${
      business.display_name
    }</b></a>
<a href="https://www.google.com/maps/search/?api=1&query=${
      business.pickup_location.location.latitude
    },${business.pickup_location.location.longitude}" target="_blank">📍 <i>${
      business.pickup_location.address.address_line
    }</i></a>
🆔 ${business.store.store_id}
`
  );
}

function hasActiveChats$() {
  return numberOfActiveChats$.pipe(
    map((numberOfActiveChats) => numberOfActiveChats > 0 && isEnabled()),
    distinctUntilChanged()
  );
}

function notify(businesses) {
  const message = formatMessage(businesses);
  cache.message = message;

  const chats = getChats();
  _.forEach(chats, (chat) => {
    message.forEach((m) => sendMessage(chat.id, m));
  });
}

function sendMessage(chatId, message) {
  return bot.telegram
    .sendMessage(chatId, message, { parse_mode: "html" })
    .catch((error) => {
      if (error.code === 403) {
        removeChat(chatId);
      } else {
        console.error(`${error.code} - ${error.description}`);
      }
    });
}

function createBot() {
  const botToken = getBotToken();
  if (!isEnabled() || !botToken) {
    return null;
  }
  const bot = new Telegraf(botToken);
  bot.command("start", startCommand);
  bot.command("stop", stopCommand);
  bot.launch();
  console.log("[Telegram] Bot started!");
  return bot;
}

function startCommand(context) {
  console.log("[Telegram] Received start command...");

  addChat(context);
  context
    .reply(
      `*bleep, bleep, bleep* ${process.env.EMAIL} | ${process.env.PASSWORD} I am the TooGoodToGo bot.
I will tell you whenever the stock of your favorites changes. *bloop*.
If you get tired of my spamming you can (temporarily) disable me with:
/stop`
    )
    .then(() =>
      sendMessage(context.chat.id, cache.message, { parse_mode: "html" })
    );
}

function stopCommand(context) {
  console.log("[Telegram] Received stop command...");

  context.reply(`*bleep* Ok.. I get it. Too much is too much. I'll stop bothering you now. *bloop*.
You can enable me again with:
/start`);
  removeChat(context.chat.id);
}

function addChat(context) {
  const chats = getChats();
  const chat = {
    id: context.chat.id,
    firstName: context.from.first_name,
    lastName: context.from.last_name,
  };
  config.set(
    "notifications.telegram.chats",
    _.unionBy(chats, [chat], (chat) => chat.id)
  );
  console.log(`Added chat ${chat.firstName} ${chat.lastName} (${chat.id})`);
  emitNumberOfActiveChats();
}

function removeChat(chatId) {
  const chats = getChats();
  const chat = _.find(chats, { id: chatId });
  if (chat) {
    config.set("notifications.telegram.chats", _.pull(chats, chat));
    console.log(`Removed chat ${chat.firstName} ${chat.lastName} (${chat.id})`);
  }
  emitNumberOfActiveChats();
}

function emitNumberOfActiveChats() {
  numberOfActiveChats$.next(getNumberOfActiveChats());
}

function isEnabled() {
  return !!config.get("notifications.telegram.enabled");
}

function getChats() {
  const chats = {
    id: process.env.TELEGRAM_CHAT_ID,
    firstName: process.env.TELEGRAM_CHAT_FIRSTNAME,
    lastName: process.env.TELEGRAM_CHAT_LASTNAME,
  };
  return chats;
}

function getBotToken() {
  return process.env.TELEGRAM_BOT_TOKEN;
}

function getNumberOfActiveChats() {
  const chats = config.get("notifications.telegram.chats");
  return _.size(chats);
}
