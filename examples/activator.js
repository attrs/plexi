module.exports = {
	start: function(ctx) {
		console.log('hello, plexi!');
		
		// create new workbench example
		var Workbench = ctx.require('plexi.workbench');
		
		// create new workbench, path will be '/workbench/hello'
		var workbench = Workbench.create('hello');
		
		// create page
		var page = new Workbench.Page({
			icon: path.join(__dirname, '/src/icon.png'),
			title: 'Hello',
			layout: Workbench.layout.DefaultLayout	
		});
		
		// create left view
		var left = new Workbench.View({
			region: 'left',
			icon: path.join(__dirname, '/src/icon-left.png'),
			title: 'Left',
			base: path.join(__dirname, '/src/'),
			html: 'lest.html'
		});
		
		// create center view
		var center = new Workbench.View({
			region: 'center',
			icon: path.join(__dirname, '/src/icon-center.png'),
			title: 'Center',
			base: path.join(__dirname, '/src/'),
			html: 'center.html'
		});
		
		page.addView(center);
		page.addView(view);
		workbench.addPage(page);
	}
};