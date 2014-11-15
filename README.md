# quassel-push

A service that monitors your quassel account for highlights and sends a pushbullet notification.

![](http://i.imgur.com/H4qcmr8.png)

## Requirements
* NodeJS
* PushBullet Account
* QuasselCore


## Install

### Installing Node

#### Windows

TODO

#### Linux

https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager#debian-and-ubuntu-based-linux-distributions

### Installing quassel-push
```
git clone https://github.com/Zren/quassel-push.git
cd quassel-push
npm install --production
```

## Update
```
git pull && npm update
```

## Configure

```
cp ./config.default.js ./config.js
```

Copy the default config to `config.js`, and edit it with your settings.

### Push to a single device

Run the script once `node main.js` after setting up the authorization token for pushbullet. It will list all your devices like so:

```
Pushing to all devices.
 abcdefghijklmnopqrstu1 Chrome
 abcdefghijklmnopqrstu2 Motorola XT1034
 abcdefghijklmnopqrstu3 Pivos XIOS DS Media Play!
 abcdefghijklmnopqrstu4 Asus Nexus 7
```

Choose which device to send to like so: `deviceId: 'abcdefghijklmnopqrstu4',`

## Run
```
node main.js
```

## Screenshots

### New Notification - Android
![](http://i.imgur.com/V3oQJ5vl.png) ![](http://i.imgur.com/6bOBb3vl.png) ![](http://i.imgur.com/Om8JtP8l.png) ![](http://i.imgur.com/ri332dPl.png)

## License
Licensed under the MIT license.
