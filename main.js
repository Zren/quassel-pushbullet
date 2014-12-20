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


function handleResponse(error, response, body, callback) {
	if (error) {
		if (typeof callback === 'function') {
			callback(error);
		}
		return;
	}

	if (response.statusCode !== 200) {
		console.log('===========================');
		console.log('response.statusCode !== 200');
		console.log('response.statusCode', response.statusCode);
		console.log('body', body);
		console.log('===========================');
		if (typeof callback === 'function') {
			callback(body);
		}
		return;
	}

	if (typeof callback === 'function') {
		callback(null, body);
	}
};

function connectToQuasselCore(coreConfig, userConfig, callback) {
	if (!userConfig.pushbullet.accessToken)
		return console.log('Please configure your pushbullet accessToken.');

	var pusher = new PushBullet(userConfig.pushbullet.accessToken);
	pusher.handleResponse = handleResponse; // Mixin our own error handler.
	var deviceId = userConfig.pushbullet.deviceId;

	var notificationQueue = {}; // {bufferId: [{timestamp: Date, buffer: Buffer, message: Message}, ...], ...}
	var pushLog = {}; // {bufferId, [pushIden, ...], ...}

	function sendNotification(type, title, body, bufferId) {
		logger.debug('[PushBullet]', {
			deviceId: deviceId,
			title: title,
			body: body
		});

		var pushFn = type == 'link' ? pusher.link : pusher.note;
		var callback = function(err, response) {
			if (err) return console.log('[PushBullet] [error]', typeof err === 'object' ? JSON.stringify(err) : err);
			logger.debug('[PushBullet]', response);
			if (bufferId) {
				if (!pushLog[bufferId]) {
					pushLog[bufferId] = [];
				}
				pushLog[bufferId].push(response.iden);
				logger.debug('pushLog', bufferId, pushLog[bufferId]);
			}
		};
		if (type == 'link') {
			pusher.link(deviceId, title, body, callback);
		} else if (type == 'note') {
			pusher.note(deviceId, title, body, callback);
		}
	}

	function buildNotification(buffer, message) {
		var type = 'note';
		var title, body, url;
		if (userConfig.webserver && userConfig.webserver.host) {
			type = 'link';
			url = 'http://' + userConfig.webserver.host + '/';
			url += '?host=' + coreConfig.host;
			url += '&user=' + userConfig.name;
			url += '&bufferId=' + buffer.id;
		}
		
		if (buffer.type == BufferType.QueryBuffer) {
			title = message.getNick() + ':';
		} else if (buffer.type == BufferType.ChannelBuffer && message.isHighlighted()) {
			title = '[' + buffer.name + '] ' + message.getNick() + ':';
		}
		if (type == 'link') {
			title += ' ' + message.content;
			body = url;
		} else {
			body = message.content;
		}

		return {
			type: type,
			title: title,
			body: body
		};
	}

	function buildNotificationList(notifications) {
		var type = 'note';
		var firstNotification = notifications[0];
		var buffer = firstNotification.buffer;
		var title = '[' + buffer.name + '] (' + notifications.length + ' Messages)';
		var body = firstNotification.message.content;
		for (var i = 1; i < notifications.length; i++) {
			body += '\n' + notifications[i].message.content;
		}

		return {
			type: type,
			title: title,
			body: body
		};
	}

	function sendQueuedNotifications(bufferId) {console.log('sendQueuedNotifications', arguments);
		var notifications = notificationQueue[bufferId].splice(0); // Move all elements to a new array in case new ones appear.
		if (notifications.length <= 0) return;

		var data;
		if (notifications.length == 1) {
			data = buildNotification(notifications[0].buffer, notifications[0].message);
		} else {
			data = buildNotificationList(notifications);
		}
		sendNotification(data.type, data.title, data.body, bufferId);
	}

	function checkNotificationQueue(bufferId) {console.log('checkNotificationQueue', arguments);
		var now = Date.now();

		// Check if we should 
		var unloadQueue = false;
		if (notificationQueue[bufferId].length > 0) {
			var firstNotification = notificationQueue[bufferId][0];
			var lastNotification = notificationQueue[bufferId][notificationQueue[bufferId].length - 1];
			var hasRecentNotication = (now - lastNotification.timestamp) < (userConfig.pushbullet.delayBeforePushing - 100); // The -100ms is in case setTimout fires early.
			var reachedMaxDelay = (now - firstNotification.timestamp) >= userConfig.pushbullet.maxDelayBeforePushing;
			if (!hasRecentNotication || reachedMaxDelay) {
				unloadQueue = true;
			}
		}

		if (unloadQueue) {
			sendQueuedNotifications(bufferId);
		}
	}

	function queueNotification(buffer, message) {console.log('queueNotification');
		var bufferId = buffer.id;
		if (!notificationQueue[bufferId]) {
			notificationQueue[bufferId] = [];
		}

		// Queue Notification
		var notification = {
			timestamp: Date.now(),
			buffer: buffer,
			message: message
		};
		notificationQueue[bufferId].push(notification);

		// Delay sending the notification(s).
		// Probably should clear previous timeout instead of checking when the timeout wakes, but meh.
		setTimeout(function(){
			checkNotificationQueue(bufferId);
		}, userConfig.pushbullet.delayBeforePushing);
	}

	function clearNotificationQueue(bufferId) {
		if (notificationQueue[bufferId]) {
			logger.debug('clearNotificationQueue', bufferId);
			notificationQueue[bufferId].splice(0);
		}
	}

	function deleteNotitications(bufferId) {
		var bufferPushes = pushLog[bufferId];
		if (!bufferPushes) return;
		bufferPushes = bufferPushes.splice(0);
		logger.debug('deleteNotitications', bufferId, bufferPushes);
		for (var i = 0; i < bufferPushes.length; i++) {
			var pushIden = bufferPushes[i];
			pusher.deletePush(pushIden, function(err, response) {
				logger.debug('deletePush', bufferId, pushIden);
			});
		}
	}

	async.series([
		// Validate deviceId.
		function(cb) {
			async.waterfall([
				function(cb) {
					console.log('Fetching PushBullet device list');
					pusher.devices(cb);
				},
				function(response, cb) {
					console.log('PushBullet device list response');
					console.log(response);
					if (userConfig.pushbullet.deviceId || userConfig.pushbullet.deviceNickname) {
						console.log('Attempting to find specified deviceId', {
							deviceId: userConfig.pushbullet.deviceId,
							deviceNickname: userConfig.pushbullet.deviceNickname
						});
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
						return cb('Device not found.');

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
				return cb('Please config the QuasselCore host/port.');
			}
			if (!userConfig.name || !userConfig.pass) {
				return cb('Please config the QuasselCore name/pass.');
			}
			var quassel = new Quassel(coreConfig.host, coreConfig.port, {
				nobacklog: true,
				nodebug: !config.debugLibQuassel,
			}, function(next) {
				console.log('Connected to QuasselCore');
				console.log('Logging into QuasselCore');
				next(userConfig.name, userConfig.pass);
			});

			// Debugging.
			if (config.debugLibQuasselEvents) {
				quassel.on('**', function() {
					var args = Array.prototype.slice.call(arguments);
					args.unshift(this.event);
					logger.debug.apply(console, args);
				});
			}

			// Reconnection logic in case we disconnect from the core.
			quassel.reconnectOnDisconnect = true; // Make sure to set to false if you want to force a disconnect.
			quassel.client.on('close', function(hadError) {
				console.log('Socket to QuasselCore closed');
				if (quassel.reconnectOnDisconnect) {
					console.log('Reconnecting to QuasselCore');
					connectToQuasselCore(coreConfig, userConfig, callback);
				}
			});
			quassel.disconnectAndExit = function() {
				quassel.reconnectOnDisconnect = false;
				quassel.disconnect();
			};

			// 
			quassel.on('login', function() {
				console.log('Logged into QuasselCore');

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

			quassel.on('loginfailed', function() {
				console.log('Failed to login into QuasselCore');
				quassel.disconnectAndExit();
			});

			// When a new message arrives, check if it's highlighted message, or if it's from a query buffer.
			// If so, queue the message, and set a timeout before sending it in case we need to group them.
			quassel.on('buffer.message', function(bufferId, messageId) {
				var buffer = quassel.getNetworks().findBuffer(bufferId);
				var message = buffer.messages.get(messageId);

				if (message.type == MessageType.Plain || message.type == MessageType.Action) {
					// logger.debug('buffer.message', buffer.name, message.getNick(), message.content);

					if (message.isSelf())
						return;

					if (buffer.type == BufferType.QueryBuffer) {
						// var data = buildNotification(buffer, message);
						// sendNotification(data.type, data.title, data.body);
						queueNotification(buffer, message);
					} else if (buffer.type == BufferType.ChannelBuffer && message.isHighlighted()) {
						// var data = buildNotification(buffer, message);
						// sendNotification(data.type, data.title, data.body);
						queueNotification(buffer, message);
					}
				}
			});

			// When a buffer is read, clear any queued notifications, and delete any pushes that were already sent for that buffer.
			quassel.on('buffer.read', function(bufferId) {
				var buffer = quassel.getNetworks().findBuffer(bufferId);
				if (userConfig.pushbullet.ignoreNotificationsFromReadBuffer) {
					clearNotificationQueue(bufferId);
				}
				if (userConfig.pushbullet.deletePushesFromReadBuffer) {
					deleteNotitications(bufferId);
				}
			});

			// Log errors, but don't exit.
			quassel.on('_error', function(err) {
				console.log('===========================');
				if (err.message && err.stack) {
					console.log('[error]', err.message);
					console.log(err.stack);
				} else {
					console.log('[error]', err);
				}
				console.log('===========================');
			});

			quassel.client.once('data', function() {
				quasel.qtsocket.on('error', function(){
					quassel.disconnect();
				});
			});

			console.log('Connecting to QuasselCore');
			quassel.connect();
			// setTimeout(function(){
			// 	console.log('Test disconnect');
			// 	quassel.disconnect();
			// }, 10000);
			cb();
		}
	], function(err) {
		if (err) return console.log('[error]', err);
	});
}

function main() {
	connectToQuasselCore(config.core, config.core.user);
}

main();
