module.exports = {
	start: function(ctx) {
		console.log(ctx.id + ' starting...');
		
		return {b:ctx.version};
	}
}