function ApplicationError( message, cause ) {
	Error.call(this, message);
	this.name = 'ApplicationError';
	this.message = message;
	this.arguments = arguments;
	this.cause = cause;
	
	Error.captureStackTrace(this, arguments.callee);
	
	if( cause instanceof Error ) {
		var stack = cause.stack.split(cause.name + ': ' + cause.message + '\n').join('');
		this.stack = this.name + (this.message ? ': ' + this.message : '') + '\n' + stack;
	}
}

//ApplicationError.prototype.__proto__ = Error.prototype;
ApplicationError.prototype = Object.create(Error.prototype);
ApplicationError.prototype.constructor = ApplicationError;

module.exports = ApplicationError;