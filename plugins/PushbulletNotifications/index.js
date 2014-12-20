var async = require('async');
var BufferType = require('libquassel/lib/buffer').IRCBuffer.Types;
var MessageType = require('libquassel/lib/message').Type;
var QuasselPushbullet = require('./QuasselPushbullet');


var pushers = {}; // {QuasselClient.userConfig.name: QuasselPushbullet, ...}

exports.load = function(quasselClient, cb) {
	quasselClient.pluginData.PushbulletNotifications = {};
	var pusher = new QuasselPushbullet(quasselClient);

	async.series([
		function(cb) {
			pusher.validateDeviceId(cb);
		},

		// Validated correctly
		function(cb) {
			// When a new message arrives, check if it's highlighted message, or if it's from a query buffer.
			// If so, queue the message, and set a timeout before sending it in case we need to group them.
			quasselClient.on('buffer.message', function(bufferId, messageId) {
				var buffer = quasselClient.getNetworks().findBuffer(bufferId);
				var message = buffer.messages.get(messageId);

				if (message.type == MessageType.Plain || message.type == MessageType.Action) {
					// logger.debug('buffer.message', buffer.name, message.getNick(), message.content);

					if (message.isSelf())
						return;

					if (buffer.type == BufferType.QueryBuffer) {
						// var data = buildNotification(buffer, message);
						// sendNotification(data.type, data.title, data.body);
						pusher.queueNotification(buffer, message);
					} else if (buffer.type == BufferType.ChannelBuffer && message.isHighlighted()) {
						// var data = buildNotification(buffer, message);
						// sendNotification(data.type, data.title, data.body);
						pusher.queueNotification(buffer, message);
					}
				}
			});

			// When a buffer is read, clear any queued notifications, and delete any pushes that were already sent for that buffer.
			quasselClient.on('buffer.read', function(bufferId) {
				var buffer = quasselClient.getNetworks().findBuffer(bufferId);
				if (quasselClient.userConfig.pushbullet.ignoreNotificationsFromReadBuffer) {
					pusher.clearNotificationQueue(bufferId);
				}
				if (quasselClient.userConfig.pushbullet.deletePushesFromReadBuffer) {
					pusher.deleteNotitications(bufferId);
				}
			});

			quasselClient.pluginData.PushbulletNotifications.pusher = pusher;
			cb();
		},
	], cb);

};
