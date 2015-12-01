#!/usr/bin/env node
'use strict';

var readline = require('readline');
var chalk = require('chalk');
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
wechat.on(WechatClient.EVENTS.LOGIN, () => { startConsole(); });
wechat.on(WechatClient.EVENTS.LOGOUT, () => {
  logger.info('Logout.');
  rl.close();
});

wechat.login();

function startConsole() {
  logger.info('Login successfully.');

  updatePrompt();
  rl.prompt(true);

  rl.on('line', onUserInput)
  .on('SIGINT', onPreExit)
  .on('close', onExit);
}

function onUserInput(msg) {
  rl.pause();
  commands.parse(msg, wechat);
  rl.prompt(true);
}

function onPreExit() {
  rl.question('Are you sure you want to exit?(y/N)', (answer) => {
    if (answer.match(/^y(es)?$/i)) {
      rl.close();
    } else {
      rl.prompt(true);
    }
  });
}

function onExit() {
  wechat.logout().then(() => { process.exit(0); });
}

function updatePrompt() {
  var prompt = 'wechat';
  if (wechat.isLogined()) {
    prompt = chalk.bold.blue(wechat.getUser());

    var chat = wechat.getChat();
    if (chat) {
      prompt += chalk.yellow(' => ') + chalk.bold.blue(chat);
    }
  }
  rl.setPrompt(prompt + chalk.yellow('> '));
}

function completer(line) {
  var hits = commands.ALL_CMD.filter((c) => { return c.indexOf(line) === 0; });
  return [hits.length ? hits : commands.ALL_CMD, line];
}
