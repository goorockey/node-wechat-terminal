var _ = require('lodash');
var logger = require('./logger');
var columnify = require('columnify');
var WechatClient = require('./wechat_client');


const CMD_MAP = {
  '\\h': ['Print this help information', help],
  '\\s': ['Send message', WechatClient.prototype.sendMsg],
  '\\c': ['Change chat', WechatClient.prototype.changeChat],
  '\\chats': ['List chats', WechatClient.prototype.listChat],
  '\\contacts': ['List contacts', WechatClient.prototype.listContact],
  '\\logout': ['logout', WechatClient.prototype.logout],
};

const ALL_CMD = exports.ALL_CMD = _.keys(CMD_MAP);

exports.parse = function(input, wechat) {
  if (!input || !input.startsWith('\\')) {
    return;
  }

  var cmd = input.split(' ')[0];
  if (!_.includes(ALL_CMD, cmd)) {
    logger.error('Command not found: ' + cmd);
    return;
  }

  var args = input.slice(cmd.length + 1);
  var func = CMD_MAP[cmd][1];
  func.bind(wechat)(args);
};

function help() {
  var data = _.transform(CMD_MAP, (result, value, key) => {
    result[key] = value[0];
  });
  console.log(columnify(data, {
    columns: ['**COMMAND**', '**DESCRIPTION**'],
    minWidth: 20,
  }));
}
