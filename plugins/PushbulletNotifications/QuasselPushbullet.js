var async = require('async');
var PushBullet = require('pushbullet');
var BufferType = require('libquassel/lib/buffer').IRCBuffer.Types;
var MessageType = require('libquassel/lib/message').Type;

var QuasselPushbullet = function(quasselClient) {
	this.quasselClient = quasselClient;
	this.pushbullet = new PushBullet(quasselClient.userConfig.pushbullet.accessToken);
	this.deviceId;
	this.notificationQueue = {}; // {bufferId: [{timestamp: Date, buffer: Buffer, message: Message}, ...], ...}
	this.pushLog = {}; // {bufferId, [pushIden, ...], ...}

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
	this.pushbullet.handleResponse = handleResponse; // Mixin our own error handler.
};

QuasselPushbullet.prototype.validateDeviceId = function(cb) {
	var self = this;
	var userConfig = this.quasselClient.userConfig;

	async.waterfall([
		function(cb) {
			console.log('Fetching PushBullet device list');
			self.pushbullet.devices(cb);
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

					if ((userConfig.pushbullet.deviceId && device.iden == userConfig.pushbullet.deviceId)
						|| (userConfig.pushbullet.deviceNickname && device.nickname == userConfig.pushbullet.deviceNickname)
					) {
						self.deviceId = device.iden;
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
		},
	], cb);
};

QuasselPushbullet.prototype.sendNotification = function(type, title, body, bufferId) {
	var self = this;
	this.quasselClient.logDebug('[PushBullet]', {
		deviceId: this.deviceId,
		title: title,
		body: body
	});

	var callback = function(err, response) {
		if (err) return console.log('[PushBullet] [error]', err);
		self.quasselClient.logDebug('[PushBullet]', response);
		if (bufferId) {
			if (!self.pushLog[bufferId]) {
				self.pushLog[bufferId] = [];
			}
			self.pushLog[bufferId].push(response.iden);
			self.quasselClient.logDebug('pushLog', bufferId, self.pushLog[bufferId]);
		}
	};
	if (type == 'link') {
		this.pushbullet.link(this.deviceId, title, body, callback);
	} else if (type == 'note') {
		this.pushbullet.note(this.deviceId, title, body, callback);
	}
};

QuasselPushbullet.prototype.buildNotification = function(buffer, message) {
	var type = 'note';
	var title, body, url;
	if (this.quasselClient.userConfig.webserver && this.quasselClient.userConfig.webserver.host) {
		type = 'link';
		url = 'http://' + this.quasselClient.userConfig.webserver.host + '/';
		url += '?host=' + this.quasselClient.coreConfig.host;
		url += '&user=' + this.quasselClient.userConfig.name;
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
};

QuasselPushbullet.prototype.buildNotificationList = function(notifications) {
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
};

QuasselPushbullet.prototype.sendQueuedNotifications = function(bufferId) {console.log('sendQueuedNotifications', arguments);
	var notifications = this.notificationQueue[bufferId].splice(0); // Move all elements to a new array in case new ones appear.
	if (notifications.length <= 0) return;

	var data;
	if (notifications.length == 1) {
		data = this.buildNotification(notifications[0].buffer, notifications[0].message);
	} else {
		data = this.buildNotificationList(notifications);
	}
	this.sendNotification(data.type, data.title, data.body, bufferId);
};

QuasselPushbullet.prototype.checkNotificationQueue = function(bufferId) {console.log('checkNotificationQueue', arguments);
	var now = Date.now();

	// Check if we should 
	var unloadQueue = false;
	if (this.notificationQueue[bufferId].length > 0) {
		var firstNotification = this.notificationQueue[bufferId][0];
		var lastNotification = this.notificationQueue[bufferId][this.notificationQueue[bufferId].length - 1];
		var hasRecentNotication = (now - lastNotification.timestamp) < (this.quasselClient.userConfig.pushbullet.delayBeforePushing - 100); // The -100ms is in case setTimout fires early.
		var reachedMaxDelay = (now - firstNotification.timestamp) >= this.quasselClient.userConfig.pushbullet.maxDelayBeforePushing;
		if (!hasRecentNotication || reachedMaxDelay) {
			unloadQueue = true;
		}
	}

	if (unloadQueue) {
		this.sendQueuedNotifications(bufferId);
	}
};

QuasselPushbullet.prototype.queueNotification = function(buffer, message) {console.log('queueNotification');
	var self = this;
	var bufferId = buffer.id;
	if (!this.notificationQueue[bufferId]) {
		this.notificationQueue[bufferId] = [];
	}

	// Queue Notification
	var notification = {
		timestamp: Date.now(),
		buffer: buffer,
		message: message
	};
	this.notificationQueue[bufferId].push(notification);

	// Delay sending the notification(s).
	// Probably should clear previous timeout instead of checking when the timeout wakes, but meh.
	setTimeout(function(){
		self.checkNotificationQueue(bufferId);
	}, this.quasselClient.userConfig.pushbullet.delayBeforePushing);
};

QuasselPushbullet.prototype.clearNotificationQueue = function(bufferId) {
	if (this.notificationQueue[bufferId]) {
		this.quasselClient.logDebug('clearNotificationQueue', bufferId);
		this.notificationQueue[bufferId].splice(0);
	}
};

QuasselPushbullet.prototype.deleteNotitications = function(bufferId) {
	var self = this;
	var bufferPushes = this.pushLog[bufferId];
	if (!bufferPushes) return;
	bufferPushes = bufferPushes.splice(0);
	this.quasselClient.logDebug('deleteNotitications', bufferId, bufferPushes);
	for (var i = 0; i < bufferPushes.length; i++) {
		var pushIden = bufferPushes[i];
		this.pushbullet.deletePush(pushIden, function(err, response) {
			self.quasselClient.logDebug('deletePush', bufferId, pushIden);
		});
	}
};

module.exports = QuasselPushbullet;
