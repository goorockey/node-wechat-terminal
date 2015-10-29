var _ = require('lodash');
var fs = require('fs');
var util = require('util');
var EventEmitter = require('events');
var FileCookieStore = require('tough-cookie-filestore');
var request = require('request-promise');
var qrcode = require('qrcode-terminal');
var parseXMLString = xml2js = require('xml2js').parseString;

var consts = require('./consts');
var logger = require('./logger');


var WechatClient = module.exports = function(opts) {
  this.opts = _.extend({
    cookies_file: './cookies.json',
  }, opts);
  this.loginData = {};
  this.user = {};
  this.contacts = [];
  this.chatList = [];

  try {
    fs.closeSync(fs.openSync(this.opts.cookies_file, 'wx'));
  } catch(e) {}

  this.cookies = request.jar(new FileCookieStore(this.opts.cookies_file));
  this.rq = request.defaults({
    jar: this.cookies,
    gzip: true,
    forever: true,
    headers: {
      'Referer': 'https://web.wechat.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:41.0) Gecko/20100101 Firefox/41.0',
    },
  });

  /////// private methods
  this.parseCode = function(field) {
    return function(body, response, resolveWithFullResponse) {
      var window = {};
      if (field) {
        window[field] = {};
      }

      eval(body);
      return field && window[field] || window;
    };
  };

  this.getUUID = function() {
    var options = {
      uri: consts.URL.JSLOGIN,
      qs: {
        '_': Date.now(),
        appid: consts.WX_APP_ID,
        fun: 'new',
        lang: 'en_US',
      },
      transform: this.parseCode('QRLogin'),
    };

    return this.rq(options).then(function(resp) {
      logger.debug(resp);
      return resp.uuid;
    });
  };

  this.printLoginQR = function(uuid) {
    var url = consts.URL.LOGIN_QRCODE + uuid;
    qrcode.generate(url);
    logger.info('Scan above qrcode using mobile wechat.')

    return uuid;  // return uuid for chained calls
  };

  this.checkLogin = function(uuid) {
    var self = this;

    logger.info('Checking...');
    return new Promise(function(resolve, reject) {
      (function doCheckLogin() {
        var options = {
          uri: consts.URL.CHECK_LOGIN,
          qs: {
            '_': Date.now(),
            r: ~new Date,
            loginicon: false,
            tip: 0,
            uuid: uuid,
          },
          qsStringifyOptions: {
            encode: false,  // disable encode for '=' in uuid
          },
          transform: self.parseCode(''),
          timeout: 35000,
        };

        self.rq(options).then(function(resp) {
          // logger.debug(resp)
          switch (parseInt(resp.code, 10)) {
            case 200:
              return resolve(resp.redirect_uri);
            case 400:
              return reject('UUID expired. Try again please.');
            case 500:
            case 0:
              return reject('Server error. Try again please.');
            case 201:
              logger.info('QRCode is scanned.');
            default:
              return doCheckLogin();
          }
        });
      })();
    });
  };

  this.webwxnewloginpage = function(url) {
    logger.debug('=====webwxnewloginpage=====');

    var options = {
      uri: url,
      qs: { fun: 'new', version: 'v2' },
    };

    return new Promise(function(resolve, reject) {
      this.rq(options).then(function(resp) {
        // logger.debug(resp);
        parseXMLString(resp, {trim: true, explicitArray: false}, function(err, result) {
          if (err) {
            return reject('Failed to parse login data.');
          }

          var data = result.error;
          if (data.ret != 0 || !data.skey || !data.wxsid || !data.wxuin || !data.pass_ticket) {
            return reject('Failed to login.')
          }

          this.updateLoginData({
            skey: data.skey,
            sid: data.wxsid,
            uin: data.wxuin,
            passTicket: data.pass_ticket,
          });
          return resolve();
        }.bind(this));
      }.bind(this));
    }.bind(this));
  };

  this.getDeviceID = function() {
    return 'e' + ('' + Math.random().toFixed(15)).substring(2, 17);
  };

  this.genBaseRequest = function(data) {
    return _.extend({
      BaseRequest: {
        Uin: this.loginData.uin,
        Sid: this.loginData.sid,
        SKey: this.loginData.skey,
        DeviceID: this.getDeviceID(),
      }
    }, data);
  };

  this.isRoomContact = function(item) {
    return item ? /^@@|@chatroom$/.test(item) : false;
  };

  this.updateLoginData = function(loginData) {
    return _.extend(this.loginData, loginData);
  };

  this.setUserInfo = function(userInfo) {
    return _.extend(this.user, userInfo);
  };

  this.clearData = function() {
    this.loginData = {};
    this.user = {};
    this.chatList = [];
    this.contacts = [];
  };

  this.addContact = function(contact) {
  };

  this.addContacts = function(contacts) {
  };

  this.initChatList = function(chat) {
    this.chatList = _.filter(chat.split(','), (item) => { return item.startsWith('@'); });
  };
  this.addChatList = function(chat) {
  };
  this.deleteChatList = function(chat) {
  };

  this.notifyMobile = function(type, toUserName) {
    var options = {
      uri: consts.URL.NOTIFY_MOBILE,
      method: 'POST',
      json: this.genBaseRequest({
        Code: type,
        FromUserName: this.user.UserName,
        ToUserName: toUserName,
        ClientMsgId: Date.now(),
      }),
    };

    return this.rq(options);
  };

  this.synccheck = function() {
  };

  this.wxinit = function() {
    logger.debug('=====wxinit=====');

    return new Promise(function(resolve, reject) {
      var options = {
        uri: consts.URL.INIT,
        method: 'POST',
        qs: {
          r: ~Date.now(),
        },
        json: this.genBaseRequest(),
      };

      this.rq(options).then(function(data) {
        // logger.debug(data, {json: true});

        if (!data || !data.BaseResponse) {
          return reject('Failed to init login.');
        }
        if (data.BaseResponse.Ret != 0) {
          return reject(data.BaseResponse.ErrMsg);
        }

        this.updateLoginData({
          skey: data.SKey,
          syncKey: data.SyncKey,
        });

        this.setUserInfo(data.User);
        this.addContacts(data.ContactList);
        this.initChatList(data.ChatSet);

        this.notifyMobile(consts.STATUS_NOTIFY.INITED);

        return resolve(this.user);
      }.bind(this));
    }.bind(this));
  };
};

util.inherits(WechatClient, EventEmitter);

WechatClient.prototype.login = function() {
  return this.getUUID()
  .then(this.printLoginQR.bind(this))
  .then(this.checkLogin.bind(this))
  .then(this.webwxnewloginpage.bind(this))
  .then(this.wxinit.bind(this))
  .then((user) => { this.emit('login', this.user); })
  .catch(this.errorHandler.bind(this));
};

WechatClient.prototype.webwxsync = function() {
};

WechatClient.prototype.logout = function() {
  return new Promise(function(resolve, reject) {
    if (!this.loginData.skey || !this.loginData.sid || !this.loginData.uin) {
      return reject('Not login yet.');
    }
    var options = {
      uri: consts.URL.LOGOUT,
      method: 'POST',
      qs: {
        skey: this.loginData.skey,
        type: 0,
      },
      form: {
        sid: this.loginData.sid,
        uin: this.loginData.uin,
      },
    };

    this.rq(options).then(function() {
      this.clearData();
      this.emit('logout');
      return resolve();
    }.bind(this));
  }.bind(this));
};

WechatClient.prototype.sendMsg = function() {
};

WechatClient.prototype.errorHandler = function(reason) {
  logger.error(reason);
  this.emit('err', reason);
};
