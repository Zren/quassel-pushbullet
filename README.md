# quassel-push

A service that monitors your quassel account for highlights and sends a pushbullet notification.

![](http://i.imgur.com/H4qcmr8.png)

## Requirements
* NodeJS
* PushBullet Account
* QuasselCore


## Install
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

## Run
```
node main.js
```

## License
Licensed under the MIT license.
