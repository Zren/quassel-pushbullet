var Quassel = require('libquassel');
var util = require('util');

var QuasselClient = function(options) {
	var self = this;

	Quassel.call(this, options.coreConfig.host, options.coreConfig.port, options.clientConfig, self.loginCallback);

	//
	this.config = options.config;
	this.clientConfig = options.clientConfig;
	this.coreConfig = options.coreConfig;
	this.userConfig = options.userConfig;
	this.reconnectOnDisconnect = true;

	//
	this.client.on('close', function(hadError) {
		self.log('Connection to QuasselCore closed.');
		if (self.reconnectOnDisconnect) {
			self.reconnect();
		}
	});

	this.on('login', function() {
		self.log('Logged into QuasselCore');

		// Don't die when libquassel parses an event badly.
		// Note that the 'uncaughtException' event may be deprecated in the future.
		// It's also not advised, however it does work in our case.
		process.on('uncaughtException', function(err) {
			console.log('===========================');
			console.log('[uncaughtException]', err.message);
			console.log(err.stack);
			console.log('===========================');
		});

	});

	this.on('loginfailed', function() {
		console.log('Failed to login into QuasselCore');
		self.disconnectAndExit();
	});

	// Log errors
	this.on('_error', function(err) {
		console.log('===========================');
		if (err.message && err.stack) {
			console.log('[error]', err.message);
			console.log(err.stack);
		} else {
			console.log('[error]', err);
		}
		console.log('===========================');
	});

	this.client.once('data', function() {
		self.qtsocket.on('error', function(){
			self.disconnect();
		});
	});
};
util.inherits(QuasselClient, Quassel);

QuasselClient.prototype.loginCallback = function(next) {
	this.log('Connected to QuasselCore');
	this.log('Logging into QuasselCore');
	next(this.userConfig.name, this.userConfig.pass);
};

QuasselClient.prototype.logDebug = function() {
	var args = Array.prototype.slice.call(arguments);
	args.unshift('[debug]');
	console.log.apply(console, args);
};

QuasselClient.prototype.disconnectAndExit = function(first_argument) {
	quassel.reconnectOnDisconnect = false;
	quassel.disconnect();
};

QuasselClient.prototype.reconnect = function() {
	this.log('Reconnecting to QuasselCore');
	
};

/**
 * libquassel class extensions
 */

var IRCBufferCollection = require('libquassel/lib/buffer').IRCBufferCollection;
IRCBufferCollection.prototype.all = function() {
	return this.buffers.values();
};

var IRCBuffer = require('libquassel/lib/buffer').IRCBuffer;
IRCBuffer.prototype.removeMessage = function(message) {
    message.id = parseInt(message.id, 10);
	this.messages.remove(message.id);
};


module.exports = QuasselClient;
