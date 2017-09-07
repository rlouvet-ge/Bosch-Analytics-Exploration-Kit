/**
 * This module can be used to set up reverse proxying from client to Predix services or custom backend microservices.
 * It assumes only one UAA instance, one UAA client, and one instance of each service.
 * Use setUaaConfig() and setServiceConfig() for local development.
 * In cloud foundry, set the following environment vars: clientId, base64ClientCredential
 * Info for bound services is read from VCAP environment variables.
 */

"use strict";

var url = require("url");
var express = require("express");
var expressProxy = require("express-http-proxy");
var HttpsProxyAgent = require("https-proxy-agent");
var request = require("request");
var config = require("./server-config");
var router = express.Router(); // eslint-disable-line new-cap

var corporateProxyServer =
	process.env.http_proxy || process.env.HTTP_PROXY ||
	process.env.https_proxy || process.env.HTTPS_PROXY;

var corporateProxyAgent;

// Constants
const HTTP_FORBIDDEN_STATUS = 403;
const HTTP_OK_STATUS = 200;

// Corporate proxy
if (corporateProxyServer) {
	corporateProxyAgent = new HttpsProxyAgent(corporateProxyServer);
}

/* ********* Define Services Routes ********* */

function cleanResponseHeaders(rsp, data, req, res, cb) {
	res.removeHeader("Access-Control-Allow-Origin");
	cb(null, data);
}

function buildDecorator(headers) {
	return function (req) {
		if (corporateProxyAgent) {
			req.agent = corporateProxyAgent;
		}
		req.headers["Content-Type"] = "application/json";

		if (headers) {
			headers.forEach(function (header) {
				req.headers[header[0]] = header[1];
			});
		}
		return req;
	};
}

function buildPathCalculator(endpoint) {
	return function (req) {
		var proxyPath = url.parse(endpoint).path;
		var reqPath = url.parse(req.url).path;

		// Build a new path with partial path from proxy endpoint and partial path from req
		if (proxyPath.endsWith("/")) {
			proxyPath = proxyPath.substring(0, proxyPath.length - 1);
		}
		if (reqPath.startsWith("/")) {
			reqPath = reqPath.substring(1, reqPath.length);
		}
		return proxyPath + "/" + reqPath;
	};
}

function setProxyRoute(key, serviceConfig) {
	var decorator;
	var pathCalculator;

	if (serviceConfig.endpoint) {
		decorator = buildDecorator(serviceConfig.headers);
		pathCalculator = buildPathCalculator(serviceConfig.endpoint);

		router.use("/" + key, expressProxy(serviceConfig.endpoint, {
			intercept: cleanResponseHeaders,
			decorateRequest: decorator,
			forwardPath: pathCalculator
		}));
	}
}

// Create routes for each Predix service registered in config.proxy
function setProxyRoutes() {
	Object.keys(config.proxy).forEach(function (key) {
		setProxyRoute(key, config.proxy[key]);
	});
}


/* ********* Add Token Middleware ********* */

function getClientToken(successCallback, errorCallback) {
	var options = {
		method: "POST",
		url: config.uaaURL + "/oauth/token",
		form: {
			grant_type: "client_credentials", // eslint-disable-line camelcase
			client_id: config.clientId // eslint-disable-line camelcase
		},
		headers: {
			Authorization: "Basic " + config.base64ClientCredential
		}
	};

	console.log(options);

	request(options, function (err, response, body) {
		var clientTokenResponse = {};

		if (!err && response.statusCode === HTTP_OK_STATUS) {
			// Debug console.log("response from getClientToken: " + body);
			clientTokenResponse = JSON.parse(body);
			successCallback(clientTokenResponse.token_type + " " + clientTokenResponse.access_token);
		} else if (errorCallback) {
			errorCallback(body);
		} else {
			console.log("ERROR fetching client token: " + body);
		}
	});
}

function getRestClientToken(successCallback, errorCallback) {
	var options = {
		method: "POST",
		url: config.uaaURL + "/oauth/token",
		form: {
			grant_type: "client_credentials", // eslint-disable-line camelcase
			client_id: config.restClientId // eslint-disable-line camelcase
		},
		headers: {
			Authorization: "Basic " + config.base64RestClientCredential
		}
	};

	console.log(options);

	request(options, function (err, response, body) {
		var clientTokenResponse = {};

		if (!err && response.statusCode === HTTP_OK_STATUS) {
			// Debug console.log("response from getClientToken: " + body);
			clientTokenResponse = JSON.parse(body);
			successCallback(clientTokenResponse.token_type + " " + clientTokenResponse.access_token);
		} else if (errorCallback) {
			errorCallback(body);
		} else {
			console.log("ERROR fetching client token: " + body);
		}
	});
}

// Fetches client token, adds to request headers, and stores in session.
// Returns 403 if no session.
// Use this middleware to proxy a request to a secure service, using a client token.
function addClientTokenMiddleware(req, res, next) {
	function errorHandler(errorString) {
		// TODO: fix, so it doesn't return a status 200.
		//  Tried sendStatus, but headers were already set.
		res.send(errorString);
	}

	// Debug console.log("proxy root route");
	if (req.session) {
		// Debug console.log("session found.");
		if (req.session.clientToken) {
			// Debug console.log("client token found in session");
			req.headers.Authorization = req.session.clientToken;
			next();
		} else {
			// Debug console.log("fetching client token");
			getClientToken(function (token) {
				req.session.clientToken = token;
				req.headers.Authorization = req.session.clientToken;
				next();
			}, errorHandler);
		}
	} else {
		next(res.sendStatus(HTTP_FORBIDDEN_STATUS).send("Forbidden"));
	}
}

// Fetches client token, adds to request headers, and stores in session.
// Returns 403 if no session.
// Use this middleware to proxy a request to a secure service, using a client token.
function addRestClientTokenMiddleware(req, res, next) {
	function errorHandler(errorString) {
		// TODO: fix, so it doesn't return a status 200.
		//  Tried sendStatus, but headers were already set.
		res.send(errorString);
	}

	// Debug console.log("proxy root route");
	if (req.session) {
		// Debug console.log("session found.");
		if (req.session.restClientToken) {
			// Debug console.log("client token found in session");
			req.headers.Authorization = req.session.restClientToken;
			next();
		} else {
			// Debug console.log("fetching client token");
			getRestClientToken(function (token) {
				req.session.restClientToken = token;
				req.headers.Authorization = req.session.restClientToken;
				next();
			}, errorHandler);
		}
	} else {
		next(res.sendStatus(HTTP_FORBIDDEN_STATUS).send("Forbidden"));
	}
}

function filterMiddleware(req, res, next) {
	var reqPath = url.parse(req.url).path;

	if (reqPath.startsWith("/ppm-connector")) {
		addRestClientTokenMiddleware(req, res, next);
	} else {
		addClientTokenMiddleware(req, res, next);
	}
}

router.use("/", filterMiddleware);


// Create the predix service routes
setProxyRoutes();

module.exports = {
	router: router,
	addClientTokenMiddleware: addClientTokenMiddleware
};
