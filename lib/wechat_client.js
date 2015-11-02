/* jshint node: true */
/* jshint maxerr: 10000 */
"use strict";

var _ = require('lodash');
var fs = require('fs');
var util = require('util');
var EventEmitter = require('events');
var FileCookieStore = require('tough-cookie-filestore');
var request = require('request-promise');
var rq_errors = require('request-promise/errors');
var qrcode = require('qrcode-terminal');
var parseXMLString = require('xml2js').parseString;
var columnify = require('columnify');

var consts = require('./consts');
var logger = require('./logger');


module.exports = class WechatClient extends EventEmitter {

  constructor(opts) {
    super();

    this.opts = _.extend({
      cookies_file: './cookies.json',
    }, opts);

    this._initData();

    try {
      fs.closeSync(fs.openSync(this.opts.cookies_file, 'wx'));
      var cookie = new FileCookieStore(this.opts.cookies_file);
    } catch(e) {
      fs.closeSync(fs.openSync(this.opts.cookies_file, 'w'));
      var cookie = new FileCookieStore(this.opts.cookies_file);
    }
    this.cookies = request.jar(cookie);

    this.rq = request.defaults({
      jar: this.cookies,
      gzip: true,
      forever: true,
      headers: {
        'Referer': 'https://web.wechat.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:41.0) Gecko/20100101 Firefox/41.0',
      },
    });
  }

  static get EVENTS() {
    return {
      LOGIN: 'login',
      LOGOUT: 'logout',
      ERROR: 'err',
      CHAT_CHANGE: 'chat_change',
    };
  };

  _initData() {
    this.loginData = {};
    this.user = {};
    this.chat = {};
    this.chatList = [];
    this.contacts = {};
    this.contactList = [];
  };

  _parseObjResponse(field) {
    return (body, response, resolveWithFullResponse) => {
      var window = {};
      if (field) {
        window[field] = {};
      }

      eval(body);
      return field && window[field] || window;
    };
  };

  _parseBaseResponse(body, response, resolveWithFullResponse) {
    if (!body || !body.BaseResponse) {
      throw util.format('Invalid response.(body=%s)', body);
    }
    if (body.BaseResponse.Ret != 0) {
      throw body.BaseResponse.Ret;
    }
    return body;
  };

  isLogined() {
    return this.loginData.skey && this.loginData.sid && this.loginData.uin;
  };

  _isSelf(user) {
    return user.UserName == this.UserName
  };

  _printLoginQR(uuid) {
    var url = consts.URL.LOGIN_QRCODE + uuid;
    qrcode.generate(url);
    logger.info('Scan above qrcode using mobile wechat.')

    return uuid;  // return uuid for chained calls
  };

  _checkLogin(uuid) {
    logger.info('Waiting for scan...');
    return new Promise((resolve, reject) => {
      var self = this;
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
          transform: self._parseObjResponse(),
          timeout: consts.TIMEOUT_LONG_PULL,
        };

        self.rq(options).then((resp) => {
          switch (Number.parseInt(resp.code, 10)) {
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
        }).catch(doCheckLogin)
        .done();
      })();
    });
  };

  _webwxnewloginpage(url) {
    // logger.debug('=====_webwxnewloginpage=====');
    var options = {
      uri: url,
      qs: { fun: 'new', version: 'v2' },
    };

    return new Promise((resolve, reject) => {
      this.rq(options).then((resp) => {
        parseXMLString(resp, {trim: true, explicitArray: false}, (err, result) => {
          if (err) {
            return reject('Failed to parse login data.');
          }

          var data = result.error;
          if (data.ret != 0 || !data.skey || !data.wxsid || !data.wxuin || !data.pass_ticket) {
            return reject('Failed to login.')
          }

          this._updateLoginData({
            skey: data.skey,
            sid: data.wxsid,
            uin: data.wxuin,
            passTicket: data.pass_ticket,
          });
          return resolve();
        });
      });
    });
  };

  static getDeviceID() {
    return 'e' + ('' + Math.random().toFixed(15)).substring(2, 17);
  };

  static getMsgID() {
    return (Date.now() + Math.random().toFixed(3)).replace('.', '');
  };

  _genBaseRequest(data) {
    return _.extend({
      BaseRequest: {
        Uin: this.loginData.uin,
        Sid: this.loginData.sid,
        SKey: this.loginData.skey,
        DeviceID: WechatClient.getDeviceID(),
      }
    }, data);
  };

  static isContact(user) {
    return user.UserName.startsWith('@') &&
      !!(user.ContactFlag & consts.CONTACT_FLAG.CONTACT) &&
      !WechatClient.isSubscribe(user);
  };

  static isSubscribe(user) {
    return user.ContactFlag == consts.CONTACT_FLAG.SUBSCRIBE;
  };

  static isRoomContact(user) {
    return user && /^@@|@chatroom$/.test(user);
  };

  static isShieldUser(user) {
    // TODO
  };

  _updateLoginData(loginData) {
    return _.extend(this.loginData, loginData);
  };

  _setUserInfo(userInfo) {
    return _.extend(this.user, userInfo);
  };

  _updateUserInfo(userInfo) {
    if (_.isEmpty(userInfo) ||
        userInfo.BitFlag != consts.PROFILE_BITFLAG.CHANGE) {
      return;
    }

    if (userInfo.NickName.Buff) {
      this._setUserInfo({
        NickName: userInfo.NickName.BUff
      });
    }
  };

  //// contact
  _addContact(user) {
    if (this.contacts[user.UserName]) {
      _.invoke(this.contactList, function() {
        // this: each item
        return (this.UserName == user.UserName) ? user : this;
      });
    } else {
      this.contactList.push(user);
    }

    this.contacts[user.UserName] = user;

    // update chat
    if (user.UserName == this.chat.UserName) {
      this._setChat(user);
    }
  };

  _addContacts(contactList) {
    _.each(contactList, this._addContact.bind(this));
  };

  _delContact(user) {
    if (this.contacts[user.UserName]) {
      _.remove(this.contactList, (u) => { return u.UserName == user.UserName; });
    }
    delete this.contacts[user.UserName];

    if (user.UserName == this.chat.UserName) {
      this._setChat();
    }
  };

  _delContacts(contactList) {
    _.each(contactList, this._delContact.bind(this));
  };

  ///// chat
  _setChat(user) {
    this.chat = user || {};
    this.emit(WechatClient.EVENTS.CHAT_CHANGE);
  };

  _removeInvalidContact(nameList) {
    return _.filter(nameList, (name) => {
      var user = this.contacts[name];
      if (!user) {
        return true;
      }

      return WechatClient.isContact(user);
    });
  };

  _initChatList(nameList) {
    this.chatList = _.filter(nameList.split(','), (item) => {
      return item.startsWith('@');
    });

    this._batchGetContact(this.chatList)
    .then(() => {
      this.chatList = this._removeInvalidContact(this.chatList);
    });

    return this.chatList;
  };

  _addChatList(userList) {
    var list = [];
    _.each(userList, (user) => {
      var name = user.UserName;
      if (!name) {
        name = user.FromUserName != this.user.UserName ? user.FromUserName : user.ToUserName;
      }

      if (name.startsWith('@') && this.chatList.indexOf(name) < 0) {
        list.push(name);
        this.chatList.push(name);
      }
    });

    this._batchGetContact(list)
    .then(() => {
      this.chatList = this._removeInvalidContact(this.chatList);
    });
    return this.chatList;
  };

  _deleteChatList(chatList) {
    return this.chatList = _.difference(this.chatList, chatList);
  };

  _getUserNickName(userName) {
    if (_.isEmpty(userName)) {
      return '';
    }

    if (userName.UserName) {
      userName = userName.UserName;
    }

    if (!this.contacts[userName]) {
      return userName;
    }

    if (this.contacts[userName].RemarkName) {
      return this.contacts[userName].RemarkName;
    } else {
      return this.contacts[userName].NickName;
    }
  };

  _getFormateSyncKey() {
    return (_.map(this.loginData.syncKey.List, (item) => {
      return item.Key + '_' + item.Val;
    })).join('|');
  };

  _printNewMsg(msg) {
    var data = {
      From: this._getUserNickName(msg.FromUserName),
      To: this._getUserNickName(msg.ToUserName),
      Message: msg.Content,
    };

    if (msg.ActualSender) {
      data.From += ' : ' + this._getUserNickName(msg.ActualSender);
    }
    console.log(columnify([data]));
  };

  _statusNotifyProcess(msg) {
    switch(msg.StatusNotifyCode) {
      case consts.STATUS_NOTIFY_CODE.SYNC_CONV:
        this._initChatList(e.StatusNotifyUserName);
      break;

      case consts.STATUS_NOTIFY_CODE.ENTER_SESSION:
        this._addChatList([msg]);
      break;
    }
  };

  _messageProcess(msgs) {
    _.each(msgs, (msg) => {
      logger.debug(util.format('New message(Type=%s)',
                               _.findKey(consts.MSG_TYPE, _.matches(msg.MsgType))));

      // parse sender of msg in chat room
      msg.Content = msg.Content.replace(/^(@[a-zA-Z0-9]+|[a-zA-Z0-9_-]+):<br\/>/, (_, sender) => {
        msg.ActualSender = sender;
        return '';
      });

      switch (Number.parseInt(msg.MsgType, 10)) {
        case consts.MSG_TYPE.TEXT:
          this._printNewMsg(msg);
          break;

        case consts.MSG_TYPE.IMAGE:
        case consts.MSG_TYPE.EMOTICON:
        case consts.MSG_TYPE.VOICE:
          console.log(util.format('New message (From=%s, Type=%s)',
                                  this._getUserNickName(msg.FromUserName),
                                  _.findKey(consts.MSG_TYPE, _.matches(msg.MsgType))));
          break;

        case consts.MSG_TYPE.STATUS_NOTIFY:
          this._statusNotifyProcess(msg);
          break;

        default:
          break;
      }

      this._addChatList([msg]);
    });
  };

  _updateChatData(data) {
    this._updateLoginData({ syncKey: data.SyncKey });
    this._updateUserInfo(data.Profile);

    // delete contact
    this._delContacts(data.DelContactList);

    // update contact
    this._addContacts(data.ModContactList);

    // process msg
    this._messageProcess(data.AddMsgList);
  };

  _notifyMobile(type, toUserName) {
    var options = {
      uri: consts.URL.NOTIFY_MOBILE,
      method: 'POST',
      json: this._genBaseRequest({
        Code: type,
        FromUserName: this.user.UserName,
        ToUserName: toUserName,
        ClientMsgId: Date.now(),
      }),
    };

    this.rq(options);
  };

  _webwxsync() {
    logger.debug('=====_webwxsync=====');
    var options = {
      uri: consts.URL.SYNC,
      method: 'POST',
      qs: {
        sid: this.loginData.sid,
        skey: this.loginData.skey,
      },
      json: this._genBaseRequest({
        rr: ~Date.now(),
        SyncKey: this.loginData.syncKey,
      }),
      transform: this._parseBaseResponse,
    };

    return new Promise((resolve, reject) => {
      this.rq(options).then((data) => {
        this._updateChatData(data);
        resolve();
      }).catch(reject).done();
    });
  };

  _batchGetContact(userList) {
    logger.debug('=====_batchGetContact=====');

    userList = userList || this.contacts;
    var list = _.map(userList, (item) => {
      return {
        UserName: item.UserName || item,
        EncryChatRoomId: item.EncryChatRoomId || '',
      };
    });

    var options = {
      uri: consts.URL.BATCH_GET_CONTACT,
      method: 'POST',
      qs: {
        r: Date.now(),
        type: 'ex',
      },
      json: this._genBaseRequest({
        Count: list.length,
        List: list,
      }),
      transform: this._parseBaseResponse,
    };

    return new Promise((resolve, reject) => {
      this.rq(options).then((data) => {
        this._addContacts(data.ContactList);
        resolve();
      }).catch(reject).done();
    });
  };

  _synccheck() {
    // logger.debug('=====_synccheck=====');

    if (!this.isLogined()) {
      return;
    }

    var options = {
      uri: consts.URL.SYNC_CHECK,
      qs: {
        '_': Date.now(),
        deviceid: WechatClient.getDeviceID(),
        r: Date.now(),
        sid: this.loginData.sid,
        skey: this.loginData.skey,
        synckey: this._getFormateSyncKey(),
        uin: this.loginData.uin,
      },
      transform: this._parseObjResponse('synccheck'),
      timeout: consts.TIMEOUT_LONG_PULL,
    };

    var logout = false;
    this.rq(options).then((resp) => {
      switch(Number.parseInt(resp.retcode, 10)) {
        case 0:
          break;
        case 1100:
          logout = true;
          return this.logout();
        default:
          throw new Error(util.format('Sync failed.(ret=%s)', resp.retcode));
      }

      switch (Number.parseInt(resp.selector, 10)) {
        case 7:
          return this._batchGetContact();
        case 2:
          return this._webwxsync();
        case 0:
        default:
          return;
      }
    }).catch((err) => {
      logger.error(err);
    }).then(() => {
      if (!logout) {
        setTimeout(this._synccheck.bind(this), consts.TIMEOUT_SYNC_CHECK);
      }
    })
    .done();
  };

  _wxgetcontact() {
    var options = {
      uri: consts.URL.GET_CONTACT,
      qs: {
        r: Date.now(),
        skey: this.loginData.skey,
        pass_ticket: this.loginData.passTicket,
      },
      transform: this._parseBaseResponse,
      json: true,
    };

    return new Promise((resolve, reject) => {
      this.rq(options).then((data) => {
        this._addContacts(data.MemberList);
        resolve();
      }).done();
    });
  };

  _wxinit() {
    logger.debug('=====_wxinit=====');

    return new Promise((resolve, reject) => {
      var options = {
        uri: consts.URL.INIT,
        method: 'POST',
        qs: {
          r: ~Date.now(),
        },
        json: this._genBaseRequest(),
        transform: this._parseBaseResponse,
      };

      this.rq(options).then((data) => {
        this._updateLoginData({
          skey: data.SKey,
          syncKey: data.SyncKey,
        });

        this._setUserInfo(data.User);
        this._addContact(data.User);
        this._addContacts(data.ContactList);
        this._initChatList(data.ChatSet);

        this._notifyMobile(consts.STATUS_NOTIFY.INITED);

        return resolve(this.user);
      }).catch(reject).done();
    });
  };

  _errorHandler(reason) {
    logger.error(reason);
    this.emit(WechatClient.EVENTS.ERROR, reason);
  };

  _getUUID() {
    var options = {
      uri: consts.URL.JSLOGIN,
      qs: {
        '_': Date.now(),
        appid: consts.WX_APP_ID,
        fun: 'new',
        lang: 'en_US',
      },
      transform: this._parseObjResponse('QRLogin'),
    };

    return this.rq(options).then((resp) => {
      logger.debug(resp);
      return resp.uuid;
    });
  };

  login() {
    return this._getUUID()
    .then(this._printLoginQR.bind(this))
    .then(this._checkLogin.bind(this))
    .then(this._webwxnewloginpage.bind(this))
    .then(this._wxinit.bind(this))
    .then((user) => { this.emit(WechatClient.EVENTS.LOGIN, this.user); })
    .then(this._wxgetcontact.bind(this))
    .then(this._synccheck.bind(this))
    .catch(this._errorHandler.bind(this))
    .done();
  };

  logout() {
    return new Promise((resolve, reject) => {
      if (!this.isLogined()) {
        return resolve();
      }

      var options = {
        uri: consts.URL.LOGOUT,
        simple: false,
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

      this.rq(options)
      .finally(() => {
        this._initData();
        this.emit(WechatClient.EVENTS.LOGOUT);
        resolve();
      });
    });
  };

  sendMsg(msg) {
    msg = _.trim(msg);
    if (!msg) {
      return;
    }

    if (!this.chat || !this.chat.UserName) {
      logger.info('Select chat target first.')
      return;
    }

    var msgId = WechatClient.getMsgID();
    var options = {
      uri: consts.URL.SEND_MSG,
      method: 'POST',
      qs: { pass_ticket: this.loginData.passTicket },
      json: this._genBaseRequest({
        Msg: {
          Content: msg,
          Type: consts.MSG_TYPE.TEXT,
          FromUserName: this.user.UserName,
          ToUserName: this.chat.UserName,
          ClientMsgId: msgId,
          LocalID: msgId,
        }
      }),
      transform: this._parseBaseResponse,
    };

    this.rq(options).finally(() => {
      logger.debug('Msg sent.')
    });
  };

  listChat(input) {
    if (input === '') {
      if (_.isEmpty(this.chatList)) {
        console.log('No chat.');
        return;
      }

      console.log('Chats:');
      _.each(this.chatList, (name, index) => {
        console.log('#' + index + ' ' + this._getUserNickName(name));
      });
      return;
    }

    var index = Number.parseInt(input, 10);
    if (Number.isNaN(index)) {
      logger.info('Enter index of chat please.')
      return;
    }

    var name = index < 0 ? this.user.UserName : this.chatList[index];
    var user = this.contacts[name];
    if (!_.isEmpty(user)) {
      this._setChat(user);
    }

  };

  listContact(input) {
    if (input === '') {
      console.log('Contacts:');
      console.log('#0 ' + this._getUserNickName(this.user));

      _.each(this.contactList, (user, index) => {
        console.log('#' + index + ' ' + this._getUserNickName(user));
      });
      return;
    }

    var index = Number.parseInt(input, 10);
    if (Number.isNaN(index)) {
      logger.info('Enter index of contact please.')
      return;
    }

    var user = index < 0 ? this.user : this.contactList[index];
    if (!_.isEmpty(user)) {
      this._setChat(user);
    }
  };

  getUser() {
    return this._getUserNickName(this.user);
  };

  getChat() {
    return this._getUserNickName(this.chat);
  };
};
