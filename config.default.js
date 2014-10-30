var config = {
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
				deviceId: null,
			}
		}
	}
};

module.exports = config;
