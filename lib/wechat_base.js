'use strict';

var _ = require('lodash');
var EventEmitter = require('events');

var consts = require('./consts');

module.exports = class WechatBase extends EventEmitter {

  constructor() {
    super();

    this._initData();
  }

  _initData() {
    this.loginData = {};
    this.user = {};
    this.chat = {};
    this.chatList = [];
    this.contacts = {};
    this.contactList = [];
  }

  _isSelf(user) {
    var username = user.UserName || user;
    return username && (username === this.user.UserName);
  }

  isLogined() {
    return Boolean(this.loginData.skey && this.loginData.sid && this.loginData.uin);
  }

  static isContact(user) {
    return user.UserName.startsWith('@') &&
      Boolean(user.ContactFlag & consts.CONTACT_FLAG.CONTACT) &&
      !WechatBase.isSubscribe(user);
  }

  static isSubscribe(user) {
    return Number.parseInt(user.ContactFlag, 10) === consts.CONTACT_FLAG.SUBSCRIBE;
  }

  static isRoomContact(user) {
    var name = user.UserName || user;
    return name && /^@@|@chatroom$/.test(name);
  }

  static isMuted(user) {
    if (!user) {
      return false;
    }

    return WechatBase.isRoomContact(user) ?
      Number.parseInt(user.Statues, 10) === consts.CHATROOM_NOTIFY.CLOSE :
      Boolean(user.ContactFlag & consts.CONTACT_FLAG.NOTIFYCLOSECONTACT);
  }

  _updateLoginData(loginData) {
    return _.extend(this.loginData, loginData);
  }

  _setUserInfo(userInfo) {
    return _.extend(this.user, userInfo);
  }

  _updateUserInfo(userInfo) {
    if (_.isEmpty(userInfo) ||
        Number.parseInt(userInfo.BitFlag, 10) !== consts.PROFILE_BITFLAG.CHANGE) {
      return;
    }

    if (userInfo.NickName.Buff) {
      this._setUserInfo({ NickName: userInfo.NickName.BUff });
    }
  }

  _getFormateSyncKey() {
    return (_.map(this.loginData.syncKey.List, (item) => {
      return item.Key + '_' + item.Val;
    })).join('|');
  }

  _getMessagePeerUserName(msg) {
    if (this._isSentMsg(msg)) {
      return msg.ToUserName;
    } else {
      return msg.FromUserName;
    }
  }

  _isSentMsg(msg) {
    return this._isSelf(msg.FromUserName);
  }

  _removeEmoji(name) {
    return name && name.replace(/<span.*?class="emoji emoji(.*?)"><\/span>/g, '');
  }

  // contact
  _addContact(user) {
    if (_.isEmpty(user)) {
      return;
    }

    user.NickName = this._removeEmoji(user.NickName);
    user.RemarkName = this._removeEmoji(user.RemarkName);

    if (this.contacts[user.UserName]) {
      _.invoke(this.contactList, function() {
        // this: each item
        return (this.UserName === user.UserName) ? user : this;
      });
    } else {
      this.contactList.push(user);
    }

    this.contacts[user.UserName] = user;

    // update chat
    if (user.UserName === this.chat.UserName) {
      this._setChat(user);
    }
  }

  _addContacts(contactList) {
    _.each(contactList, this._addContact.bind(this));
  }

  _delContact(user) {
    if (this.contacts[user.UserName]) {
      _.remove(this.contactList, (u) => { return u.UserName === user.UserName; });
    }
    delete this.contacts[user.UserName];

    if (user.UserName === this.chat.UserName) {
      this._setChat();
    }
  }

  _delContacts(contactList) {
    _.each(contactList, this._delContact.bind(this));
  }

  _setChat(user) {
    this.chat = user || {};
  }

  _removeInvalidContact(nameList) {
    return _.filter(nameList, (name) => {
      var user = this.contacts[name];
      if (!user) {
        return true;
      }

      return WechatBase.isContact(user);
    });
  }

  _initChatList(nameList) {
    this.chatList = _.filter(nameList.split(','), (item) => {
      return item.startsWith('@');
    });

    this._batchGetContact(this.chatList)
    .then(() => {
      this.chatList = this._removeInvalidContact(this.chatList);
    });

    return this.chatList;
  }

  _addChatList(msgList) {
    var list = [];
    _.each(msgList, (msg) => {
      var name = msg.UserName || this._getMessagePeerUserName(msg);
      if (name.startsWith('@') && this.chatList.indexOf(name) < 0) {
        list.push(name);
        this.chatList.push(name);
      }
    });

    this._batchGetContact(list).then(() => {
      this.chatList = this._removeInvalidContact(this.chatList);
    });
    return this.chatList;
  }

  _deleteChatList(chatList) {
    this.chatList = _.difference(this.chatList, chatList);
    return this.chatList;
  }

  _getUserNickName(userName, full) {
    if (_.isEmpty(userName)) {
      return '';
    }

    userName = userName.UserName || userName;
    var user = this.contacts[userName];
    if (!user) {
      return userName;
    }

    var name = user.RemarkName || user.NickName;
    if (full && user.RemarkName) {
      name = `${user.NickName} (${user.RemarkName})`;
    }

    if (WechatBase.isRoomContact(userName)) {
      name += ' (Room)';
    }
    return name;
  }

  _updateChatData(data) {
    this._updateLoginData({ syncKey: data.SyncKey });
    this._updateUserInfo(data.Profile);

    // delete contact
    this._delContacts(data.DelContactList);

    // update contact
    this._addContacts(data.ModContactList);
  }
}
