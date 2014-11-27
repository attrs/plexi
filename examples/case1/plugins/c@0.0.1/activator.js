module.exports = {
	start: function(ctx) {
		console.log(this.identity + ' starting...');
		
		return {c:this.identity.version};
	}
}