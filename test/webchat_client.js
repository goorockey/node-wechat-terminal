require('chai').should();
var WechatClient = require('../lib/wechat_client');

describe('wechat_client', function() {
  describe('login', function() {
    describe('#isLogined()', function() {
      it('should return false if not logined', function() {
        var wechat = new WechatClient();
        wechat.isLogined().should.be.false;
        wechat.getUser().should.be.empty;
        wechat.getChat().should.be.empty;
      });
    });
  });
});
