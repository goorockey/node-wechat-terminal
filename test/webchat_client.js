require('chai').should();
var WechatClient = require('../lib/wechat_client');

const NETWORK_TIMEOUT = 10000;

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

    describe('#getUUID()', function() {
      this.timeout(NETWORK_TIMEOUT);

      it('should return uuid', function(done) {
        var wechat = new WechatClient();
        wechat._getUUID().then((uuid) => {
          uuid.should.not.be.empty;
          uuid.should.be.a('string');
          done();
        });
      });
    });

    describe('#checkLogin()', function() {
      it('should success with redirect_uri', function(done) {
        done();
      });

      it('should fail with UUID expired', function(done) {
        done();
      });

      it('should fail with server error', function(done) {
        done();
      });

      it('should retry when qrcode is scanned', function(done) {
        done();
      });

      it('should retry when timeout', function(done) {
        done();
      });
    });

    describe('#webwxnetloginpage()', function() {
      it('should success and get login data', function(done) {
        done();
      });

      it('should fail with error ret code', function(done) {
        done();
      });
    });

    describe('#wxinit()', function() {
      it('should init all user data', function(done) {
        done();
      });

      it('should fail with error ret code', function(done) {
        done();
      });
    });

    describe('#getContact()', function() {
      it('should save contact list', function(done) {
        done();
      });
    });

    describe('#syncCheck()', function() {
      it('should not call when not logined', function(done) {
        done();
      });

      it('should retry when timeout', function(done) {
        done();
      });

      it('should retry when error happened', function(done) {
        done();
      })

      it('should exit when logout', function(done) {
        done();
      });

      it('should call wxsync()', function(done) {
        done();
      });
    });
  });
});
