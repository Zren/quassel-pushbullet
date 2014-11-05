var Quassel = require('libquassel');
var PushBullet = require('pushbullet');
var async = require('async');
var BufferType = require('libquassel/lib/buffer').IRCBuffer.Types;
var MessageType = require('libquassel/lib/message').Type;

var config = require('./config');

var logger = {
	log: function(){ console.log.apply(console, arguments); },
	debug: function(){
		var args = Array.prototype.slice.call(arguments);
		args.unshift('[debug]');
		console.log.apply(console, args);
	}
}

function connectToQuasselCore(coreConfig, userConfig, callback) {
	var pusher = new PushBullet(userConfig.pushbullet.accessToken);
	var deviceId = userConfig.pushbullet.deviceId;

	function sendNotification(title, body) {
		logger.debug('[PushBullet]', { deviceId: deviceId, title: title, body: body});
		pusher.note(deviceId, title, body, function(err, response) {
			if (err) return console.log('[PushBullet] [error]', JSON.stringify(err));
			logger.debug('[PushBullet]', response);
		});
	}

	async.series([
		function(cb) {
			// Validate deviceId.
			async.waterfall([
				function(cb) {
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
			var quassel = new Quassel(coreConfig.host, coreConfig.port, {
				nobacklog: true,
				nodebug: true,
			}, function(next) {
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

			quassel.connect();
		}
	], function(err) {
		if (err) return console.log('[error]', JSON.stringify(err));
	});
}

function main() {
	connectToQuasselCore(config.core, config.core.user);
}

main();
