module.exports = {
	start: function(ctx) {
		console.log(ctx.id + ' starting...');
		
		return {a:ctx.version};
	}
}