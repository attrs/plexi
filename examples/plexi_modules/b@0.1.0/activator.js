module.exports = {
	start: function(ctx) {
		console.log(ctx.identity.toString() + ' started');
		
		return {
			b: true
		};
	}
}