var Quassel = require('libquassel');
var PushBullet = require('pushbullet');
var async = require('async');
var BufferType = require('libquassel/lib/buffer').IRCBuffer.Types;
var MessageType = require('libquassel/lib/message').Type;

console.log('Loading config.');
var config = require('./config');
console.log('Config loaded.');

var logger = {
	log: function() { console.log.apply(console, arguments); },
	debug: function() {
		var args = Array.prototype.slice.call(arguments);
		args.unshift('[debug]');
		console.log.apply(console, args);
	}
}

function connectToQuasselCore(coreConfig, userConfig, callback) {
	if (!userConfig.pushbullet.accessToken)
		return console.log('Please configure your pushbullet accessToken.');

	var pusher = new PushBullet(userConfig.pushbullet.accessToken);
	var deviceId = userConfig.pushbullet.deviceId;

	function sendNotification(title, body) {
		logger.debug('[PushBullet]', { deviceId: deviceId, title: title, body: body});
		pusher.note(deviceId, title, body, function(err, response) {
			if (err) return console.log('[PushBullet] [error]', typeof err === 'object' ? JSON.stringify(err) : err);
			logger.debug('[PushBullet]', response);
		});
	}

	async.series([
		function(cb) {
			// Validate deviceId.
			async.waterfall([
				function(cb) {
					console.log('Fetching PushBullet device list');
					pusher.devices(cb);
				},
				function(response, cb) {
					if (userConfig.pushbullet.deviceId || userConfig.pushbullet.deviceNickname) {
						// Find the device
						for (var i in response.devices) {
							var device = response.devices[i];
							if (deviceId && device.iden == deviceId) {
								console.log('Pushing to ', device.iden, device.nickname);
								return cb();
							} else if (userConfig.pushbullet.deviceNickname && device.nickname == userConfig.pushbullet.deviceNickname) {
								deviceId = device.iden;
								console.log('Pushing to ', device.iden, device.nickname);
								return cb();
							}
						}

						// Device not found.
						// List devices for user.
						console.log('Device not found. Please confgire to use one of the following (or none at all).');
						for (var i in response.devices) {
							var device = response.devices[i];
							console.log('', device.iden, device.nickname);
						}
						// And exit.
						return cb({
							msg: 'Device not found.',
							exit: true
						});

					} else {
						// deviceId/deviceNickname not specified so we don't need to validate it exists.
						console.log('Pushing to all devices.');
						// List devices for user. In case they want to specify only 1 device.
						for (var i in response.devices) {
							var device = response.devices[i];
							console.log('', device.iden, device.nickname);
						}
						return cb();
					}
				}
			], cb);
		},

		// Connect to Quassel
		function(cb) {
			if (!coreConfig.host || !coreConfig.port) {
				return cb({
					msg: 'Please config the QuasselCore host/port.',
					exit: true
				});
			}
			if (!userConfig.name || !userConfig.pass) {
				return cb({
					msg: 'Please config the QuasselCore name/pass.',
					exit: true
				});
			}
			var quassel = new Quassel(coreConfig.host, coreConfig.port, {
				nobacklog: true,
				nodebug: true,
			}, function(next) {
				console.log('Connected to QuasselCore');
				console.log('Logging into QuasselCore');
				next(userConfig.name, userConfig.pass);
			});

			// Debugging.
			quassel.on('**', function() {
				var args = Array.prototype.slice.call(arguments);
				args.unshift(this.event);
				// logger.debug.apply(console, args);
			});

			//
			quassel.on('buffer.message', function(bufferId, messageId) {
				var buffer = quassel.getNetworks().findBuffer(bufferId);
				var message = buffer.messages.get(messageId);

				if (message.type == MessageType.Plain || message.type == MessageType.Action) {
					// logger.debug('buffer.message', buffer.name, message.getNick(), message.content);			

					if (message.isSelf())
						return;

					if (buffer.type == BufferType.QueryBuffer) {
						var title = message.getNick();
						var body = message.content;
						sendNotification(title, body);
					} else if (buffer.type == BufferType.ChannelBuffer && message.isHighlighted()) {
						var title = message.getNick() + ' - ' + buffer.name;
						var body = message.content;
						sendNotification(title, body);
					}
				}
			});

			console.log('Connecting to QuasselCore');
			quassel.connect();
			cb();
		}
	], function(err) {
		if (err) return console.log('[error]', typeof err === 'object' ? JSON.stringify(err) : err);
	});
}

function main() {
	connectToQuasselCore(config.core, config.core.user);
}

main();
