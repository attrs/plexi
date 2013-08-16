function somethingAsync(fn) {
	setTimeout(function() {
		fn(null, 50);
	}, 500);
}


function test() {
	var callback = function(err, data) {
		if( err ) console.log('callback error', err);
		console.log('callback called!', data);
	};
		
	var sum = 0;
	var tasks = [];
	for(var i=0; i < 10; i++) {
		(function(i) {
			tasks.push(function() {
				console.log('loop ' + i);

				var fn = function(err, data) {
					if( err ) return callback(err, data);

					sum += data;

					var next = tasks[i+1];
					if( next ) next();
					else callback(null, sum);
				}
				
				somethingAsync(fn);
			});
		})(i);
	}

	tasks[0]();
}

test();


