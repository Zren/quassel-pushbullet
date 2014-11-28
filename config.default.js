var config = {
	// Debugging
	debug: false,
	debugLibQuassel: false,
	debugLibQuasselEvents: false,
	// Debug PushBullet by setting the environment variable NODE_DEBUG=request
	// Eg: NODE_DEBUG=request node main.js

	core: {
		host: 'localhost',
		port: 4242,

		user: {
			// This is your Quassel User/Pass
			name: '',
			pass: '',

			pushbullet: {
				// Grab your access token here: https://www.pushbullet.com/account
				// Eg: accessToken: 'v1qabsdfjksdflkjsdaflkahsdfjklasfjksdsdfdfDFi',
				accessToken: '',

				// Which device to send the notification to.
				// All Devices: Do not specify a deviceId or deviceNickname.
				// Single Device:
				// 		A DeviceId will look like: ujAjoxHjkmidjAiVsKnSTs
				// 		To find a deviceId, either:
				//			*	Run quassel-pushbullet without a device specified, it will list all devices it pushes to.
				//				Kill it and set the new id before restarting quassel-pushbullet.
				//			*	Visit https://www.pushbullet.com/ and click a device.
				//				The URL should now look like https://www.pushbullet.com/?device_iden=ujAjoxHjkmidjAiVsKnSTs
				//				Copy the device id from the URL.
				// Eg: deviceId: 'ujAjoxHjkmidjAiVsKnSTs',
				deviceId: '',

				// OR
				//		Specify a device nickname.
				deviceNickname: '',

				// Time to wait in Milliseconds before sending the notification.
				//   * If it recieves a MarkBufferAsRead signal, it will not send
				//     a notification since another quassel client read the message.
				//   * If another message is recieved on the same buffer that triggers
				//     a notification, the delay restarts and groups the notifications.
				//   * If a second message is recieved, it will group the notifications
				//     into a single push.
				delayBeforePushing: 10000, // milliseconds. = 10 seconds
				maxDelayBeforePushing: 30000, // milliseconds. = 30 seconds
			},

			// This is the configuration for linking to a quassel-webserver in the footer of the notification.
			// https://github.com/magne4000/quassel-webserver
			webserver: {
				host: ''
			}
		}
	}
};

module.exports = config;
