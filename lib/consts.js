exports.DOMAIN = {
  true: {
    'login': 'https://login.weixin.qq.com',
    'sync': 'https://webpush.weixin.qq.com',
    'web': 'https://wx.qq.com',
  },
  false: {
    'login': 'https://login.weixin.qq.com',
    'sync': 'https://webpush2.weixin.qq.com',
    'web': 'https://wx2.qq.com',
  },
};

exports.URL = {
  // login
  JSLOGIN: '/jslogin',
  LOGIN_QRCODE: '/l/',
  LOGIN_QRCODE_FETCH: '/qrcode/',
  CHECK_LOGIN: '/cgi-bin/mmwebwx-bin/login',

  // sync
  SYNC_CHECK: '/cgi-bin/mmwebwx-bin/synccheck',

  // web
  LOGOUT: '/cgi-bin/mmwebwx-bin/webwxlogout',
  INIT: '/cgi-bin/mmwebwx-bin/webwxinit',
  SYNC: '/cgi-bin/mmwebwx-bin/webwxsync',
  GET_CONTACT: '/cgi-bin/mmwebwx-bin/webwxgetcontact',
  BATCH_GET_CONTACT: '/cgi-bin/mmwebwx-bin/webwxbatchgetcontact',
  SEND_MSG: '/cgi-bin/mmwebwx-bin/webwxsendmsg',
  NOTIFY_MOBILE: '/cgi-bin/mmwebwx-bin/webwxstatusnotify',
};

exports.WX_APP_ID = 'wx782c26e4c19acffb';
exports.TIMEOUT_SYNC_CHECK = 3000;
exports.TIMEOUT_LONG_PULL = 35000;
exports.MAX_NETWORK_HISTORY = 50;
exports.MAX_CHAT_HISTORY = 80;

exports.STATUS_NOTIFY = {
  READED: 1,
  ENTER_SESSION: 2,
  INITED: 3,
  SYNC_CONV: 4,
  QUIT_SESSION: 5,
};

exports.MSG_TYPE = {
  TEXT: 1,
  IMAGE: 3,
  VOICE: 34,
  VIDEO: 43,
  MICROVIDEO: 62,
  EMOTICON: 47,
  APP: 49,
  VOIPMSG: 50,
  VOIPNOTIFY: 52,
  VOIPINVITE: 53,
  LOCATION: 48,
  STATUSNOTIFY: 51,
  SYSNOTICE: 9999,
  POSSIBLEFRIEND_MSG: 40,
  VERIFYMSG: 37,
  SHARECARD: 42,
  SYS: 10000,
  RECALLED: 10002,
};

exports.CONTACT_FLAG = {
  CONTACT: 1,
  CHATCONTACT: 2,
  SUBSCRIBE: 3,
  CHATROOMCONTACT: 4,
  BLACKLISTCONTACT: 8,
  DOMAINCONTACT: 16,
  HIDECONTACT: 32,
  FAVOURCONTACT: 64,
  SNSBLACKLISTCONTACT: 256,
  NOTIFYCLOSECONTACT: 512,
  TOPCONTACT: 2048,
};

exports.PROFILE_BITFLAG = {
  NOCHANGE: 0,
  CHANGE: 190,
};

exports.STATUS_NOTIFY_CODE = {
  READED: 1,
  ENTER_SESSION: 2,
  INITED: 3,
  SYNC_CONV: 4,
  QUIT_SESSION: 5,
};

exports.CHATROOM_NOTIFY = {
  OPEN: 1,
  CLOSE: 0,
};

exports.SEX = {
  MALE: 1,
  FEMALE: 2,
};
