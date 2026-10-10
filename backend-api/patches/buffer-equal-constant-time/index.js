'use strict';
/**
 * buffer-equal-constant-time drop-in replacement.
 * upstream 1.0.1 references require('buffer').SlowBuffer which was removed in
 * Node 25+, crashing any consumer (jwa -> jws -> jsonwebtoken) at require time.
 * API compatible: bufferEq(a, b) plus install()/restore() no-ops.
 */
const { timingSafeEqual } = require('crypto');

function bufferEq(a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

bufferEq.install = function () {
  Buffer.prototype.equal = function equal(that) {
    return bufferEq(this, that);
  };
};

const origBufEqual = Buffer.prototype.equal;
bufferEq.restore = function () {
  Buffer.prototype.equal = origBufEqual;
};

module.exports = bufferEq;
