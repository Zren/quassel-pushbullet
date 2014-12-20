var async = require('async');
var fs = require('fs');
var path = require('path');

var PluginManager = function(quasselClient, pluginDirPath) {
    this.pluginDirPath =pluginDirPath;
    this.quasselClient = quasselClient;
    this.plugins = [];
    this.quasselClient.pluginData = {};
};

PluginManager.prototype.loadPlugins = function() {
    var self = this;
    var filenames = fs.readdirSync(this.pluginDirPath);
    this.plugins = filenames.map(function(filename) {
        var pluginFilepath = path.join(self.pluginDirPath, filename);
        console.log('[Plugin]', 'Loaded: ' + filename);
        return require(pluginFilepath);
    });
};

PluginManager.prototype.createData = function(first_argument) {
    // body...
};

PluginManager.prototype.trigger = function(eventName, cb) {
    var self = this;
    async.eachSeries(this.plugins, function(plugin, cb) {
        if (plugin[eventName]) {
            plugin[eventName](self.quasselClient, cb);
        }
    }, cb);
};

module.exports = PluginManager;
