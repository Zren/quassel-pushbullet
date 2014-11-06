var config = {
	debug: false,
	core: {
		host: 'localhost',
		port: 4242,

		user: {
			// This is your Quassel User/Pass
			name: '',
			pass: '',
			
			pushbullet: {
				// Grab your access token here: https://www.pushbullet.com/account
				accessToken: '',

				// Which device to send the notification to.
				// All Devices: null
				// Single Device:
				// 		A DeviceId will look like: ujAjoxHjkmidjAiVsKnSTs
				// 		To find a deviceId, either:
				//			*	Run quassel-push without a deviceId specified, it will list all devices it pushes to.
				//				Kill it and set the new id before restarting it.
				//			*	Visit https://www.pushbullet.com/ and click a device.
				//				The URL should now look like https://www.pushbullet.com/?device_iden=ujAjoxHjkmidjAiVsKnSTs
				//				Copy the device id from the URL.
				deviceId: null,
				// OR
				//		Specify a device nickname.
				deviceNickname: null,
			}
		}
	}
};

module.exports = config;
