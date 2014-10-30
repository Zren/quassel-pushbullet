var Quassel = require('libquassel');
var PushBullet = require('pushbullet');
var BufferType = require('libquassel/lib/buffer').IRCBuffer.Types;
var MessageType = require('libquassel/lib/message').Type;

var config = require('./config');

function connectToQuasselCore(coreConfig, userConfig) {
	var pusher = new PushBullet(userConfig.pushbullet.accessToken);

	function sendNotification(title, body) {
		pusher.note(null, title, body);
		console.log('[PushBullet]', { title: title, body: body});
	}

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
		// console.log.apply(console, args);
	});

	//
	quassel.on('buffer.message', function(bufferId, messageId) {
		var buffer = quassel.getNetworks().findBuffer(bufferId);
		var message = buffer.messages.get(messageId);

		if (message.type == MessageType.Plain || message.type == MessageType.Action) {
			// console.log('buffer.message', buffer.name, message.getNick(), message.content);			

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

	return quassel;
}

function main() {
	var connection = connectToQuasselCore(config.core, config.core.user);
}

main();
