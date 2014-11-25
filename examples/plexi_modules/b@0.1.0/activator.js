module.exports = {
	start: function(ctx) {
		console.log(ctx.identity.pluginId + '@' + ctx.identity.version + ' started');
	}
}