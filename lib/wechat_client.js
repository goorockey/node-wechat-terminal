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
  this.user = {};

  try {
    fs.closeSync(fs.openSync(this.opts.cookies_file, 'wx'));
  } catch(e) {}

  this.cookies = request.jar(new FileCookieStore(this.opts.cookies_file));
  this.rq = request.defaults({
    jar: this.cookies,
    gzip: true,
    forever: true,
    headers: {
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.8,zh-CN;q=0.5,zh;q=0.3',
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
      logger.info(resp);
      return resp.uuid;
    });
  };

  this.printLoginQR = function(uuid) {
    var url = consts.URL.LOGIN_QRCODE + uuid;
    logger.debug(url);

    qrcode.generate(url);
    logger.info('Scan above qrcode using mobile wechat.')

    return uuid;  // return uuid for chained calls
  };

  this.checkLogin = function(uuid) {
    var self = this;

    // TODO: option for check time limit

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
          logger.debug(resp)
          switch (parseInt(resp.code, 10)) {
            case 200:
              return resolve(resp.redirect_uri);
            case 400:
              return reject('UUID expired. Try again please.');
            case 500:
            case 0:
              return reject('Server error. Try again please.');
            default:
              return doCheckLogin();
          }
        });
      })();
    });
  };

  this.webwxnewloginpage = function(url) {
    var options = {
      uri: url,
      qs: { fun: 'new', version: 'v2' },
    };

    return new Promise(function(resolve, reject) {
      this.rq(options).then(function(body) {
        logger.debug(body);
        parseXMLString(body, {trim: true}, function(err, result) {
          if (err) {
            return reject('Failed to parse login data.');
          }

          var data = result.error;
          if (data.ret != 0) {
            return reject('Failed to login.')
          }

          this.user.skey = data.skey;
          this.user.wxsid = data.wxsid;
          this.user.wxuin = data.wxuin;
          this.user.passTicket = data.pass_ticket;

          return resolve(this.user);
        });
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
  .then((user) => { this.emit('login', this.user); })
  .catch(this.errorHandler.bind(this));
};

WechatClient.prototype.wxinit = function() {
};

WechatClient.prototype.synccheck = function() {
};

WechatClient.prototype.webwxsync = function() {
};

WechatClient.prototype.logout = function() {
  return new Promise(function(resolve, reject) {
    if (!this.user.skey || !this.user.wxsid || !this.user.wxuin) {
      return reject('Not login yet.');
    }
    var options = {
      uri: consts.URL.LOGOUT,
      method: 'POST',
      qs: {
        skey: this.user.skey,
        type: 0,
      },
      form: {
        sid: this.user.wxsid,
        uin: this.user.wxuin,
      },
    };

    this.rq(options).then(function() {
      this.user = {};
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
