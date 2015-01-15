var async = require('async');
var fs = require('fs');
var path = require('path');

var PluginManager = function(quasselClient) {
    this.quasselClient = quasselClient;
    this.plugins = [];
    this.quasselClient.pluginData = {};
};

PluginManager.prototype.loadPlugins = function(pluginDirPath) {
    var self = this;
    var filenames = fs.readdirSync(pluginDirPath);
    var newPlugins = filenames.map(function(filename) {
        var pluginFilepath = path.join(pluginDirPath, filename);
        console.log('[Plugin]', 'Loaded: ' + pluginFilepath);
        return require(pluginFilepath);
    });
    this.plugins = this.plugins.concat(newPlugins);
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
