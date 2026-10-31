class APICallError extends Error {}
class NoObjectGeneratedError extends Error {
  static isInstance() {
    return false;
  }
}
const Output = { object: options => ({ type: 'object', ...options }) };
const generateText = async () => {
  throw new Error('AI SDK is unavailable in unit tests');
};
module.exports = { APICallError, NoObjectGeneratedError, Output, generateText };

