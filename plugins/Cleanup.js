var humanizedBytes = function(bytes) {
	var exp = Math.log(bytes) / Math.log(1024) | 0;
	var result = (bytes / Math.pow(1024, exp)).toFixed(2);

	return result + ' ' + (exp == 0 ? 'bytes': 'KMGTPEZY'[exp - 1] + 'B');
};

var humanizedByteDiff = function(byteDiff) {
	return (byteDiff >= 0 ? '+' : '-') + humanizedBytes(Math.abs(byteDiff));
}

exports.load = function(quasselClient, cb) {
	var getMessageCount = function() {
		var messageCount = 0;
		quasselClient.networks.hm.forEach(function(network) {
			network.buffers.buffers.forEach(function(buffer) {
				messageCount += buffer.messages.count();
			});
		});
		return messageCount;
	};

	var cleanupInterval = 2 * 60 * 1000;
	var oldMessageAge = cleanupInterval * 2;

	var lastCleanupDoneAt = new Date() - cleanupInterval;
	var lastMemoryUsage = process.memoryUsage();
	quasselClient.on('buffer.message', function(bufferId, messageId) {
		var now = new Date();
		if (now - lastCleanupDoneAt >= cleanupInterval) {
			var memoryUsageBefore = process.memoryUsage();

			// Remove old messages.
			var messageCount = getMessageCount();
			var removedMessageCount = 0;
			quasselClient.networks.hm.forEach(function(network) {
				network.buffers.buffers.forEach(function(buffer) {
					buffer.messages.forEach(function(message) {
						if (now - message.datetime >= oldMessageAge) {
							buffer.removeMessage(message);
							removedMessageCount += 1;
						}
					});
				});
			});

			// Run GC
			if (global.gc) {
				global.gc();
			}

			// Logging
			var memoryUsageAfter = process.memoryUsage();
			var heapTotalDiff = memoryUsageAfter.heapTotal -  memoryUsageBefore.heapTotal;
			var heapUsedDiff = memoryUsageAfter.heapUsed - memoryUsageBefore.heapUsed;
			var msg = '';
			msg += '[Cleanup]';
			msg += '\n\t(' + messageCount + ' - ' + removedMessageCount + ' = ' + getMessageCount() + ' messages)';
			if (heapTotalDiff !== 0)
				msg += '\n\t(heapTotal: ' + humanizedBytes(memoryUsageBefore.heapTotal) + ' => ' + humanizedBytes(memoryUsageAfter.heapTotal) + ' | diff: ' + humanizedByteDiff(heapTotalDiff) + ')';
			if (heapUsedDiff !== 0)
				msg += '\n\t(heapUsed: ' + humanizedBytes(memoryUsageBefore.heapUsed) + ' => ' + humanizedBytes(memoryUsageAfter.heapUsed) + ' | diff: ' + humanizedByteDiff(heapUsedDiff) + ')';
			quasselClient.logDebug(msg);

			lastCleanupDoneAt = now;
			lastMemoryUsage = memoryUsageAfter;
		}
	});

	cb();
};
