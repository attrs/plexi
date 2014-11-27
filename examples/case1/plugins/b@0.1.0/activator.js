module.exports = {
	start: function(ctx) {
		console.log(this.identity + ' starting...');
		
		return {b:this.identity.version};
	}
}