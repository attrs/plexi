function ApplicationError( message, detail ) {
	Error.call(this, message);
	this.name = 'ApplicationError';
	this.message = message;
	this.arguments = arguments;
	this.detail = detail;
	
	Error.captureStackTrace(this, arguments.callee);
	
	if( detail instanceof Error ) {
		var stack = detail.stack.split(detail.name + ': ' + detail.message + '\n').join('');
		this.stack = this.name + (this.message ? ': ' + this.message : '') + '\n' + stack;
	}
}

ApplicationError.prototype.__proto__ = Error.prototype;


module.exports = ApplicationError;