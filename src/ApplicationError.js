function ApplicationError( message, detail ) {
  this.name = 'ApplicationError';
  this.message = message;
  this.detail = detail;
  Error.call(this, message);
  Error.captureStackTrace(this, arguments.callee);
}

ApplicationError.prototype.__proto__ = Error.prototype;


module.exports = ApplicationError;