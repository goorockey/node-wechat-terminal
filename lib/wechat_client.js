var _ = require('lodash');
var util = require('util');
var EventEmitter = require('events');


var WechatClient = module.exports = function(opts) {
    this.opts = _.extend({}, opts);
    this.user = {};

}

util.inherits(WechatClient, EventEmitter);

WechatClient.prototype.login = function() {
};

WechatClient.prototype.wxinit = function() {
};

WechatClient.prototype.synccheck = function() {
};

WechatClient.prototype.webwxsync = function() {
};

WechatClient.prototype.logout = function() {
};

WechatClient.prototype.saveCookies = function() {
}

WechatClient.prototype.loadCookies = function() {
}
