"use strict"

var readline = require('readline');
var WechatClient = require('./wechat_client');

var wechat = new WechatClient();
var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
});

wechat.on('chat_change', function(chat) {
    updatePrompt(wechat.user, chat);
});

updatePrompt();
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

function updatePrompt(user, chat) {
    rl.setPrompt((user + chat || 'wechat') + '> ');
}

function parseCmd(cmd) {
}
