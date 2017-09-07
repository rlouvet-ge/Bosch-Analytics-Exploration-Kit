/*
 This module reads config settings from local-config.json when running locally,
 or from the VCAPS environment variables when running in Cloud Foundry.
 */

"use strict";

var cfenv = require("cfenv");
var url = require("url");
var nodeEnv = process.env.node_env || "development";
var vcap = {};
var localConfig;
var env;
var services;

var serverConfig = {
	nodeEnv: nodeEnv,
	proxy: {}
};


var getCredentials = {
	"predix-uaa": function (credentials) {
		serverConfig.uaaURL = credentials.uri;
		serverConfig.base64ClientCredential = process.env.base64ClientCredential;
		serverConfig.clientId = process.env.clientId;

		if (serverConfig.appURL) {
			serverConfig.callbackURL = serverConfig.appURL + "/callback";
		} else {
			console.log("Uaa should be configured after the appURL was set");
		}
	},
	"predix-timeseries": function (credentials) {
		// The uri exposed in VCAP for timeseries contains the path to query datapoints
		var uri = url.parse(credentials.query.uri);

		serverConfig.proxy["predix-timeseries"] = {
			endpoint: uri.protocol + "//" + uri.host,
			headers: [
				[credentials.query["zone-http-header-name"], credentials.query["zone-http-header-value"]]
			]
		};
	},
	"predix-asset": function (credentials) {
		serverConfig.proxy["predix-asset"] = {
			endpoint: credentials.uri,
			headers: [
				[credentials.zone["http-header-name"], credentials.zone["http-header-value"]]
			]
		};
	},
	analytics: function (credentials) {
		serverConfig.proxy.analytics = {
			endpoint: credentials.uri
		};
	},
	"ppm-connector": function (credentials) {
		serverConfig.base64RestClientCredential = process.env.base64RestClientCredential;
		serverConfig.restClientId = process.env.restClientId;
		serverConfig.proxy["ppm-connector"] = {
			endpoint: credentials.uri
		};
	}
};


// Export environment variable if local env
if (!process.env.VCAP_APPLICATION) {
	localConfig = require("./local-config.json")[nodeEnv]; // eslint-disable-line global-require
	process.env.clientId = localConfig.clientId;
	process.env.base64ClientCredential = localConfig.base64ClientCredential;
	process.env.restClientId = localConfig.restClientId;
	process.env.base64RestClientCredential = localConfig.base64RestClientCredential;
	process.env.PORT = localConfig.serverPort;
	vcap = localConfig.vcap;
}

env = cfenv.getAppEnv({vcap: vcap});

// Application configuration
serverConfig.appURL = env.url;
serverConfig.port = env.port;


// Services configuration
services = env.getServices();

Object.keys(services).forEach(function (serviceName) {
	var service = services[serviceName];
	var getCurrentServiceCredentials = getCredentials[service.name] || getCredentials[service.label];

	if (getCurrentServiceCredentials) {
		getCurrentServiceCredentials(service.credentials);
	} else {
		console.log("There is no defined way to get credentials for service " + service.name);
	}
});

// Detect environment
serverConfig.uaaIsConfigured = Boolean(serverConfig.clientId &&
	serverConfig.uaaURL &&
	serverConfig.uaaURL.indexOf("https") === 0 &&
	serverConfig.base64ClientCredential);


module.exports = serverConfig;
