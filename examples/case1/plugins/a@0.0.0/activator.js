module.exports = {
	start: function(ctx) {
		console.log(this.identity + ' starting...');
		
		return {a:this.identity.version};
	}
}