exports.load = function(quasselClient, cb) {
	if (quasselClient.config.debugLibQuasselEvents) {
		quasselClient.on('**', function() {
			var args = Array.prototype.slice.call(arguments);
			args.unshift(this.event);
			quasselClient.logDebug.apply(quasselClient, args);
		});
	}

	cb();
};
