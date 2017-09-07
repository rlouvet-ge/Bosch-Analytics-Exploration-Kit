"use strict";

var path = require("path");
var express = require("express");
// Used for session cookie
var cookieParser = require("cookie-parser");
var bodyParser = require("body-parser");
// Simple in-memory session is used here. use connect-redis for production!!
var session = require("express-session");
// Used to send gziped files
var compression = require("compression");
// Used when requesting data from real services.
var proxy = require("./proxy");
// Get config serverConfig from local file or VCAPS env var in the cloud
var config = require("./server-config");
// Configure passport for authentication with UAA
var passportConfig = require("./passport-config");


// Only used if you have configured properties for UAA
var passport;
var mainAuthenticate;

// Express server
var app = express();

// Constants
const HTTP_INTERNAL_ERROR_STATUS = 500;


/**********************************************************************
 SETTING UP EXPRESS SERVER
 ***********************************************************************/

app.set("trust proxy", 1);
app.use(cookieParser("predixsample"));
app.use(compression());
// Initializing default session store
// *** Use this in-memory session store for development only. Use redis for prod. **
app.use(session({
	secret: "predixsample",
	name: "cookie_name",
	proxy: true,
	resave: true,
	saveUninitialized: true
}));

if (config.uaaIsConfigured) {
	passport = passportConfig.configurePassportStrategy(config);
	app.use(passport.initialize());
	// Also use passport.session() middleware, to support persistent login sessions (recommended).
	app.use(passport.session());

	mainAuthenticate = function (options) {
		return passport.authenticate("main", options);
	};
} else {
	mainAuthenticate = function () {
		return function (req, res, next) {
			next();
		};
	};
}


// Initializing application modules
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

app.listen(config.port, function () {
	console.log("Server is listening at: " + config.appURL);
});

/****************************************************************************
 SET UP EXPRESS ROUTES
 *****************************************************************************/

if (config.uaaIsConfigured) {
	// Login route redirect to predix uaa login page
	app.get("/login", passport.authenticate("predix", {scope: ""}),
		function (req, res) { // eslint-disable-line no-unused-vars,no-empty-function

		});

	// Callback route redirects to secure route after login
	app.get("/callback", passport.authenticate("predix", {failureRedirect: "/"}),
		function (req, res) {
			console.log("Redirecting to secure route..." + req.url);
			res.redirect("/");
		});

	// Logout route
	app.get("/logout", function (req, res) {
		req.session.destroy();
		req.logout();
		// Reset auth tokens
		passportConfig.reset();
		res.redirect(config.uaaURL + "/logout?redirect=" + config.appURL);
	});

}

// Secured route to access Predix services or backend microservices
app.use("/api", mainAuthenticate({noredirect: true}), proxy.router);

// Route for direct calls to view
app.use("/view-*", mainAuthenticate({noredirect: false}),
	function (req, res) {
		res.sendFile(process.cwd() + "/public/index.html");
	}
);

// Use this route to make the entire app secure.  This forces login for any path in the entire app.
app.use("/", mainAuthenticate({noredirect: false}),
	express.static(path.join(__dirname, process.env["base-dir"] ? process.env["base-dir"] : "../public"))
);


// //// error handlers //////

// Development error handler - prints stacktrace
if (config.nodeEnv === "development") {
	app.use(function (err, req, res, next) {
		console.error(err.stack);
		if (res.headersSent) {
			return next(err);
		}
		res.status(err.status || HTTP_INTERNAL_ERROR_STATUS);
		return res.send({
			message: err.message,
			error: err
		});
	});
}

// Production error handler
// No stacktraces leaked to user
app.use(function (err, req, res, next) { // eslint-disable-line no-unused-vars
	if (!res.headersSent) {
		res.status(err.status || HTTP_INTERNAL_ERROR_STATUS);
		res.send({
			message: err.message,
			error: {}
		});
	}
});

module.exports = app;
