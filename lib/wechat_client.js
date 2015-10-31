var _ = require('lodash');
var fs = require('fs');
var util = require('util');
var EventEmitter = require('events');
var FileCookieStore = require('tough-cookie-filestore');
var request = require('request-promise');
var qrcode = require('qrcode-terminal');
var parseXMLString = xml2js = require('xml2js').parseString;
var columnify = require('columnify');

var consts = require('./consts');
var logger = require('./logger');


var WechatClient = module.exports = function(opts) {
  this.opts = _.extend({
    cookies_file: './cookies.json',
  }, opts);
  this.loginData = {};
  this.user = {};
  this.chat = {};
  this.contacts = {};
  this.contactList = [];

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
  this.parseObjResponse = function(field) {
    return function(body, response, resolveWithFullResponse) {
      var window = {};
      if (field) {
        window[field] = {};
      }

      eval(body);
      return field && window[field] || window;
    };
  };

  this.parseBaseResponse = function(body, response, resolveWithFullResponse) {
    if (!body || !body.BaseResponse) {
      throw util.format('Invalid response.(body=%s)', body);
    }
    if (body.BaseResponse.Ret != 0) {
      throw body.BaseResponse.Ret;
    }
    return body;
  };

  this.isLogined = function() {
    return this.loginData.skey && this.loginData.sid && this.loginData.uin;
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
      transform: this.parseObjResponse('QRLogin'),
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

    logger.info('Waiting for scan...');
    return new Promise(function(resolve, reject) {
      (function doCheckLogin() {
        var options = {
          uri: consts.URL.CHECK_LOGIN,
          qs: {
            '_': Date.now(),
            r: ~Date.now(),
            loginicon: false,
            tip: 0,
            uuid: uuid,
          },
          qsStringifyOptions: {
            encode: false,  // disable encode for '=' in uuid
          },
          transform: self.parseObjResponse(),
          timeout: consts.TIMEOUT_LONG_PULL,
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
        }).catch(function() {
          return doCheckLogin();
        }).done();
      })();
    });
  };

  this.webwxnewloginpage = function(url) {
    // logger.debug('=====webwxnewloginpage=====');
    var options = {
      uri: url,
      qs: { fun: 'new', version: 'v2' },
    };

    return new Promise(function(resolve, reject) {
      this.rq(options).then(function(resp) {
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

  this.getMsgID = function() {
    return (Date.now() + Math.random().toFixed(3)).replace('.', '');
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

  this.isSelf = function (user) {
    return user.UserName == this.UserName
  };

  this.isContact = function (user) {
    return user.UserName.startsWith('@') &&
      !!(user.ContactFlag & consts.CONTACT_FLAG.CONTACT) &&
      !this.isSubscribe(user) &&
      !this.isSelf(user);
  };

  this.isSubscribe = function(user) {
    return user.ContactFlag == consts.CONTACT_FLAG.SUBSCRIBE;
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

  this.updateUserInfo = function(userInfo) {
    if (_.isEmpty(userInfo) ||
        userInfo.BitFlag != consts.PROFILE_BITFLAG.CHANGE) {
      return;
    }

    if (userInfo.NickName.Buff) {
      this.setUserInfo({
        NickName: userInfo.NickName.BUff
      });
    }
  };

  this.addContact = function(user) {
    if (!this.isContact(user)) {
      return;
    }
    if (this.contacts[user.UserName]) {
      _.remove(this.contactList, (u) => { return u.UserName == user.UserName; });
    }

    this.contactList.push(user);
    this.contacts[user.UserName] = user;
  };

  this.addContacts = function(contacts) {
    _.each(contacts, function(item) {
      this.addContact(item);
    }.bind(this));
  };

  this.delContact = function(user) {
    if (this.contacts[user.UserName]) {
      _.remove(this.contactList, (u) => { return u.UserName == user.UserName; });
    }
    delete this.contacts[user.UserName];
  };

  this.setChat = function(user) {
    this.chat = user || {};
    this.emit('chat_change');
  };

  this.clearChatData = function() {
    this.loginData = {};
    this.user = {};
    this.contacts = {};
    this.contactList = [];
  };

  this.getUserNickName = function(userName) {
    return this.contacts[userName] && this.contacts[userName].NickName || userName;
  };

  this.getFormateSyncKey = function() {
    return (_.map(this.loginData.syncKey.List, function(item) {
      return item.Key + '_' + item.Val;
    })).join('|');
  };

  this.printNewMsg = function(msg) {
    var fromUserName = this.getUserNickName(msg.FromUserName);
    console.log(columnify([{
      'From': fromUserName,
      'Message': msg.Content,
    }]));
  };

  this.messageProcess = function(msg) {
    logger.debug(util.format('New message(Type=%s)',
                             _.findKey(consts.MSG_TYPE, msg.MsgType)));

    msg.Content = msg.Content.replace(/^(@[a-zA-Z0-9]+|[a-zA-Z0-9_-]+):<br\/>/, '');

    switch (parseInt(msg.MsgType, 10)) {
      case consts.MSG_TYPE.TEXT:
        this.printNewMsg(msg);
        break;

      case consts.MSG_TYPE.IMAGE:
      case consts.MSG_TYPE.EMOTICON:
      case consts.MSG_TYPE.VOICE:
        console.log(util.format('New message (From=%s, Type=%s)',
                                this.getUserNickName(msg.FromUserName),
                                _.findKey(consts.MSG_TYPE, msg.MsgType)));
        break;

      default:
        break;
    }
  };

  this.updateChatData = function(data) {
    this.updateLoginData({ syncKey: data.SyncKey });
    this.updateUserInfo(data.Profile);

    // delete contact
    _.each(data.DelContactList, function(item) {
      this.delContact(item);
      if (item.UserName == chat.UserName) {
        this.setChat();
      }
    }.bind(this));

    // update contact
    this.addContacts(data.ModContactList);

    // process msg
    _.each(data.AddMsgList, function(item) {
      this.messageProcess(item);
    }.bind(this));
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

    this.rq(options);
  };

  this.webwxsync = function() {
    logger.debug('=====webwxsync=====');
    var options = {
      uri: consts.URL.SYNC,
      method: 'POST',
      qs: {
        sid: this.loginData.sid,
        skey: this.loginData.skey,
      },
      json: this.genBaseRequest({
        rr: ~Date.now(),
        SyncKey: this.loginData.syncKey,
      }),
      transform: this.parseBaseResponse,
    };

    return new Promise(function(resolve, reject) {
      this.rq(options).then(function(data) {
        this.updateChatData(data);
        resolve();
      }.bind(this)).catch(function(err) {
        reject(err);
      }).done();
    }.bind(this));
  };

  this.batchGetContact = function() {
    logger.debug('=====batchGetContact=====');
    var list = _.map(this.contacts, function(item) {
      return {
        UserName: item.UserName,
        EncryChatRoomId: item.EncryChatRoomId,
      };
    });

    var options = {
      uri: consts.URL.BATCH_GET_CONTACT,
      method: 'POST',
      qs: {
        r: Date.now(),
        type: 'ex',
      },
      json: this.genBaseRequest({
        Count: list.length,
        List: list,
      }),
      transform: this.parseBaseResponse,
    };

    return new Promise(function(resolve, reject) {
      this.rq(options).then(function(data) {
        this.addContacts(data.ContactList);
        resolve();
      }.bind(this)).catch(function(err) {
        reject(err);
      }).done();
    }.bind(this));
  };

  this.synccheck = function() {
    // logger.debug('=====synccheck=====');

    if (!this.isLogined()) {
      return;
    }

    var options = {
      uri: consts.URL.SYNC_CHECK,
      qs: {
        '_': Date.now(),
        deviceid: this.getDeviceID(),
        r: Date.now(),
        sid: this.loginData.sid,
        skey: this.loginData.skey,
        synckey: this.getFormateSyncKey(),
        uin: this.loginData.uin,
      },
      transform: this.parseObjResponse('synccheck'),
      timeout: consts.TIMEOUT_LONG_PULL,
    };

    var logout = false;
    this.rq(options).then(function(resp) {
      switch(parseInt(resp.retcode, 10)) {
        case 0:
          break;
        case 1100:
          logout = true;
          return this.logout();
        default:
          throw new Error(util.format('Sync failed.(ret=%s)', resp.retcode));
      }

      switch (parseInt(resp.selector, 10)) {
        case 7:
          return this.batchGetContact();
        case 2:
          return this.webwxsync();
        case 0:
        default:
          return;
      }

    }.bind(this)).catch(function(err) {
      logger.error(err);
    }).then(function() {
      if (!logout) {
        setTimeout(this.synccheck.bind(this), consts.TIMEOUT_SYNC_CHECK);
      }
    }.bind(this))
    .done();
  };

  this.wxgetcontact = function() {
    var options = {
      uri: consts.URL.GET_CONTACT,
      qs: {
        r: Date.now(),
        skey: this.loginData.skey,
        pass_ticket: this.loginData.passTicket,
      },
      transform: this.parseBaseResponse,
      json: true,
    };

    return new Promise(function(resolve, reject) {
      this.rq(options).then(function(data) {
        this.addContacts(data.MemberList);
        resolve();
      }.bind(this)).done();
    }.bind(this));
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
        transform: this.parseBaseResponse,
      };

      this.rq(options).then(function(data) {
        this.updateLoginData({
          skey: data.SKey,
          syncKey: data.SyncKey,
        });

        this.setUserInfo(data.User);
        this.addContacts(data.ContactList);

        this.notifyMobile(consts.STATUS_NOTIFY.INITED);

        return resolve(this.user);
      }.bind(this)).catch(function(err) {
        reject(err);
      }).done();
    }.bind(this));
  };
};

util.inherits(WechatClient, EventEmitter);

////// public methods
WechatClient.prototype.errorHandler = function(reason) {
  logger.error(reason);
  this.emit('err', reason);
};

WechatClient.prototype.login = function() {
  return this.getUUID()
  .then(this.printLoginQR.bind(this))
  .then(this.checkLogin.bind(this))
  .then(this.webwxnewloginpage.bind(this))
  .then(this.wxinit.bind(this))
  .then((user) => { this.emit('login', this.user); })
  .then(this.wxgetcontact.bind(this))
  .then(this.synccheck.bind(this))
  .catch(this.errorHandler.bind(this))
  .done();
};

WechatClient.prototype.logout = function() {
  return new Promise(function(resolve, reject) {
    if (!this.isLogined()) {
      return resolve();
    }

    var options = {
      uri: consts.URL.LOGOUT,
      method: 'POST',
      qs: {
        skey: this.loginData.skey,
        type: 0,
        redirect: 0,
      },
      form: {
        sid: this.loginData.sid,
        uin: this.loginData.uin,
      },
    };

    this.rq(options).then(function() {
      this.clearChatData();
      console.log('qeqwwerwerwer');
      this.emit('logout');
      resolve();
    }.bind(this)).catch(function() {
      resolve();
    }).done();
  }.bind(this));
};

WechatClient.prototype.sendMsg = function(msg) {
  msg = _.trim(msg);
  if (!msg) {
    return;
  }

  if (!this.chat || !this.chat.UserName) {
    logger.info('Select chat target first.')
    return;
  }

  var msgId = this.getMsgID();
  var options = {
    uri: consts.URL.SEND_MSG,
    method: 'POSt',
    qs: { pass_ticket: this.loginData.passTicket },
    json: this.genBaseRequest({
      Msg: {
        Content: msg,
        Type: consts.MSG_TYPE.TEXT,
        FromUserName: this.user.UserName,
        ToUserName: this.chat.UserName,
        ClientMsgId: msgId,
        LocalID: msgId,
      }
    }),
    transform: this.parseBaseResponse,
  };

  this.rq(options).finally(function() {
    logger.debug('Msg sent.')
  });
};

WechatClient.prototype.changeChat = function(index) {
  try {
    index = parseInt(index, 10);
    var user = index === 0 ? this.user : this.contactList[index - 1];
    if (!_.isEmpty(user)) {
      this.setChat(user);
    }
  } catch(e) {
    logger.info('Enter index of contact please.')
  }
};

WechatClient.prototype.listContact = function() {
  console.log('Contacts:');
  console.log('#0 ' + this.user.NickName +
              (this.user.RemarkName ? ' (' + this.user.RemarkName + ')' : ''));

  _.each(this.contactList, function(item, index) {
    console.log('#' + (index + 1) + ' ' +
                item.NickName +
                (item.RemarkName ? ' (' + item.RemarkName + ')' : ''));
  });
};
