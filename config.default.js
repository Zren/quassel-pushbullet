var config = {
	debug: false,
	core: {
		host: 'localhost',
		port: 4242,

		user: {
			name: '',
			pass: '',
			pushbullet: {
				// Grab your access token here: https://www.pushbullet.com/account
				accessToken: '',

				// Which device to send the notification to.
				// All Devices: null
				// Single Device:
				// 		A DeviceId will look like: ujAjoxHjkmidjAiVsKnSTs
				// 		To find a deviceId, visit https://www.pushbullet.com/ and click a device.
				//    The URL should now look like https://www.pushbullet.com/?device_iden=ujAjoxHjkmidjAiVsKnSTs
				//    Copy the device id from the URL.
				deviceId: null,
			}
		}
	}
};

module.exports = config;
