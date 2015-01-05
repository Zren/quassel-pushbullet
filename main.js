// Check if NodeJS is <= v0.10.x, since libquassel requires v0.11.x at minimum.
var m = /^v(\d+)\.(\d+)\.(\d+)$/.exec(process.version);
var nodeMinorVersion = parseInt(m[2], 10);
if (nodeMinorVersion <= 10) {
    console.log('libquassel requires NodeJS v11. You have ' + process.version);
    process.exit(1);
}

var async = require('async');
var path = require('path');
var QuasselClient = require('./lib/QuasselClient');
var PluginManager = require('./lib/PluginManager');

var main = function(config) {
	var quasselClient;
	var pluginManager;
	async.series([
		// QuasselClient
		function(cb) {
			var coreConfig = config.core;
			var userConfig = config.core.user;

			if (!coreConfig.host || !coreConfig.port) {
				return cb('Please configure the QuasselCore host/port.');
			}
			if (!userConfig.name || !userConfig.pass) {
				return cb('Please configure the QuasselCore name/pass.');
			}

			var options = {};
			options.config = config;
			options.clientConfig = {
				nobacklog: true, // Documented key
				nobacklogs: true, // https://github.com/magne4000/node-libquassel/issues/3
				nodebug: !config.debugLibQuassel,
			};
			options.coreConfig = coreConfig;
			options.userConfig = userConfig;
			quasselClient = new QuasselClient(options);
			pluginManager = new PluginManager(quasselClient, path.join(__dirname, 'plugins'));
			pluginManager.loadPlugins();
			cb();
		},

		// Plugin.preconnect
		function(cb) {
			pluginManager.trigger('load', cb);
		},

		// QuasselClient.connect
		function(cb) {
			console.log('Connecting to QuasselCore');
			quasselClient.connect();
			cb();
		},
	], function(err) {
		if (err) return console.log('[Error]', err);
	});
};

var config;
try {
	config = require('./config');
} catch (e) {
	console.log('[Error] Could not load ./config.js, copy ./config.default.js to ./config.js and edit it with your settings.');
	process.exit();
}
main(config);
