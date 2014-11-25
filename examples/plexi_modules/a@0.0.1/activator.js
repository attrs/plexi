module.exports = {
	start: function(ctx) {
		console.log('ctx', ctx);
		console.log(ctx.identity.pluginId + ' started');
	}
}