'use strict';

var readline = require('readline');
var WechatClient = require('./lib/wechat_client');
var logger = require('./lib/logger');
var commands = require('./lib/commands');

var wechat = new WechatClient();
var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true,
  completer: completer,
});

wechat.on(WechatClient.EVENTS.ERROR, () => { rl.close(); });
wechat.on(WechatClient.EVENTS.CHAT_CHANGE, () => { updatePrompt(); });
wechat.on(WechatClient.EVENTS.LOGIN, startConsole);
wechat.on(WechatClient.EVENTS.LOGOUT, () => {
  logger.info('Logout.');
  rl.close();
});

wechat.login();

function startConsole() {
  logger.info('Login successfully.');

  updatePrompt();
  rl.prompt();

  rl.on('line', onUserInput)
  .on('SIGINT', onPreExit)
  .on('close', onExit);
}

function onUserInput(msg) {
  commands.parse(msg, wechat);
  rl.prompt();
}

function onPreExit() {
  rl.question('Are you sure you want to exit?(y/N)', (answer) => {
    if (answer.match(/^y(es)?$/i)) {
      rl.close();
    } else {
      rl.prompt();
    }
  });
}

function onExit() {
  wechat.logout().then(() => { process.exit(0); });
}

function updatePrompt() {
  var prompt = 'wechat';
  if (wechat.isLogined()) {
    prompt = wechat.getUser();

    var chat = wechat.getChat();
    if (chat) {
      prompt += ' => ' + chat;
    }
  }
  rl.setPrompt(prompt + '> ');
}

function completer(line) {
  var hits = commands.ALL_CMD.filter((c) => { return c.indexOf(line) === 0; });
  return [hits.length ? hits : commands.ALL_CMD, line];
}
