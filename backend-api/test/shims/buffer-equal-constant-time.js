'use strict';
/**
 * buffer-equal-constant-time jest shim
 * 원본 패키지(1.0.1)가 Node 25+ 에서 제거된 SlowBuffer 를 참조해 크래시하므로
 * 테스트 환경에서는 crypto.timingSafeEqual 기반 shim 으로 대체한다.
 */
const { timingSafeEqual } = require('crypto');

function bufferEq(a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) return false;
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

bufferEq.install = function () {};
bufferEq.restore = function () {};

module.exports = bufferEq;
