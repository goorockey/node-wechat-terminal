var _ = require('lodash');
var logger = require('./logger');
var columnify = require('columnify');
var WechatClient = require('./wechat_client');


const CMD_MAP = {
  '\\h': ['Print this help information', help],
  '\\logout': ['Logout', WechatClient.prototype.logout],
  '\\user': ['Display user info', WechatClient.prototype.displayUserInfo],
  '\\chat': ['List chat or select chat target by index', WechatClient.prototype.listChat],
  '\\contact': ['List contact or select chat target by index', WechatClient.prototype.listContact],
  '\\back': ['Quit chat', WechatClient.prototype.quitChat],
  '\\search': ['Search in contact', WechatClient.prototype.searchContact],
  '\\history': ['Display history of chat', WechatClient.prototype.chatHistory],
  '\\room': ['List room in contact', WechatClient.prototype.listRoom],
  '\\member': ['List member of room', WechatClient.prototype.listMember],
};

const DEBUG_CMD_MAP = {
  '\\debug': ['Debug mode', debug],
  '\\network': ['Display network history', WechatClient.prototype.displayNetworkHistory],
};

const ALL_CMD = exports.ALL_CMD = _.keys(CMD_MAP);
const ALL_DEBUG_CMD = _.keys(DEBUG_CMD_MAP);

const EXTRA_HELP_INFO = '**CAUTIOUS**: After select chat target, input is sent after ENTER!';

function help() {
  var data = _.transform(CMD_MAP, (result, value, key) => {
    result[key] = value[0];
  });
  console.log(columnify(data, {
    columns: ['COMMAND', 'DESCRIPTION'],
    minWidth: 20,
  }));

  console.log('\n' + EXTRA_HELP_INFO);
}

function debug() {
  var levels = ['debug', 'info'];
  var index = levels.indexOf(logger.transports.console.level);
  index = Math.max((index + 1) % levels.length, 0);
  logger.transports.console.level = levels[index];
  logger.debug('Log mode: ' + levels[index]);
}

exports.parse = function(input, wechat) {
  if (!input) {
    return;
  }

  // if in chat, send message directly
  if (!input.startsWith('\\') && wechat.getChat()) {
    wechat.sendMsg(input);
    return;
  }

  var cmd = _.trim(input.split(' ')[0]);
  if (!_.includes(ALL_CMD, cmd) && !_.includes(ALL_DEBUG_CMD, cmd)) {
    logger.error(`Command not found: ${cmd}. Use \h to get help.`);
    return;
  }

  var args = _.trim(input.slice(cmd.length + 1));
  var func = (CMD_MAP[cmd] || DEBUG_CMD_MAP[cmd])[1];
  func.bind(wechat)(args);
};

