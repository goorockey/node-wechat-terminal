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
wechat.on('chat_change', (chat) => { updatePrompt(wechat.user); });

wechat.on('logout', function() {
  logger.info('Logout.');
  rl.close();
});

wechat.on('login', startConsole);
wechat.login();

function startConsole(user) {
  logger.info('Login successfully.');

  updatePrompt(user);
  rl.prompt();

  rl.on('line', function(msg) {
    commands.parse(msg, wechat);
    rl.prompt();
  }).on('SIGINT', function() {
    rl.question('Are you sure you want to exit?(y/N)', function(answer) {
      if (answer.match(/^y(es)?$/i)) {
        rl.close();
      } else {
        rl.prompt();
      }
    });
  });
}

function updatePrompt(user) {
  var name = user.NickName || '';
  var chat = user.chat || '';
  rl.setPrompt(((name + chat) || 'wechat') + '> ');
}

function completer(line) {
  var hits = commands.ALL_CMD.filter((c) => { return c.indexOf(line) == 0 });
  return [hits.length ? hits : commands.ALL_CMD, line];
}
