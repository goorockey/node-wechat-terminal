"use strict"

var readline = require('readline');
var WechatClient = require('./lib/wechat_client');
var logger = require('./lib/logger');

var wechat = new WechatClient();
var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true,
});

wechat.on('err', () => { rl.close(); });
wechat.on('chat_change', (chat) => { updatePrompt(wechat.user, chat); });

wechat.on('login', function(user) {
  updatePrompt(user);
  rl.prompt();

  rl.on('line', function(msg) {
    var cmd = parseCmd(msg);
    if (cmd) {

    }

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
});
wechat.on('logout', () => { rl.close(); });

wechat.login();

function updatePrompt(user, chat) {
  user = user || '';
  chat = chat || '';
  rl.setPrompt(((user + chat) || 'wechat') + '> ');
}

function parseCmd(cmd) {
}
