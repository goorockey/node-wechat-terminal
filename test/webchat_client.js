var assert = require('chai').assert;
require('chai').should();
var WechatClient = require('../lib/wechat_client');

describe('wechat_client', function() {
  describe('login', function() {
    describe('#isLogined()', function() {
      it('should return false if not logined', function() {
        var wechat = new WechatClient();
        wechat.isLogined().should.equal(false);
      });
    });
  });
});
