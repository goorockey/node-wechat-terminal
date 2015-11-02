"use strict"

var _ = require('lodash');
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


wechat.on('err', () => { rl.close(); });
wechat.on('chat_change', () => { updatePrompt(); });
wechat.on('login', startConsole);
wechat.on('logout', () => {
  logger.info('Logout.');
  rl.close();
});

wechat.login();

function startConsole(user) {
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
  rl.question('Are you sure you want to exit?(y/N)', function(answer) {
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
  var name = !_.isEmpty(wechat.user) && wechat.user.NickName || '';
  var chat = !_.isEmpty(wechat.chat) && wechat.chat.NickName ? ' => ' + wechat.chat.NickName : '';
  rl.setPrompt(((name + chat) || 'wechat') + '> ');
}

function completer(line) {
  var hits = commands.ALL_CMD.filter((c) => { return c.indexOf(line) == 0 });
  return [hits.length ? hits : commands.ALL_CMD, line];
}
