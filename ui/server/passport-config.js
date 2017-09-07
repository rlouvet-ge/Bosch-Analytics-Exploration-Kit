/*
 This module setups the Passport strategy for Predix
 */

"use strict";

var passport = require("passport");
var CloudFoundryStrategy = require("passport-predix-oauth").Strategy;
var OAuth2RefreshTokenStrategy = require("passport-oauth2-middleware").Strategy;
var cfStrategy;

/* eslint-disable no-inline-comments,line-comment-position,capitalized-comments,no-magic-numbers,no-throw-literal */

function configurePassportStrategy(predixConfig) {
	var refreshStrategy = new OAuth2RefreshTokenStrategy({
		refreshWindow: 10, // Time in seconds to perform a token refresh before it expires
		userProperty: "ticket", // Active user property name to store OAuth tokens
		authenticationURL: "/login", // URL to redirect unathorized users to
		callbackParameter: "callback" // URL query parameter name to pass a return URL
	});

	passport.use("main", refreshStrategy);  // Main authorization strategy that authenticates
											// user with stored OAuth access token
											// and performs a token refresh if needed

	// Passport session setup.
	//   To support persistent login sessions, Passport needs to be able to
	//   serialize users into and deserialize users out of the session.  Typically,
	//   this will be as simple as storing the user ID when serializing, and finding
	//   the user by ID when deserializing.  However, since this example does not
	//   have a database of user records, the complete CloudFoundry profile is
	//   serialized and deserialized.
	passport.serializeUser(function (user, done) {
		// console.log("From USER-->"+JSON.stringify(user));
		done(null, user);
	});
	passport.deserializeUser(function (obj, done) {
		done(null, obj);
	});

	function getSecretFromEncodedString(encoded) {
		var decoded;
		var values;

		if (!encoded) {
			return "";
		}
		decoded = new Buffer(encoded, "base64").toString();
		// console.log("DECODED:  " + decoded);
		values = decoded.split(":");
		if (values.length !== 2) {
			throw "base64ClientCredential is not correct. \n " +
			"It should be the base64 encoded value of: 'client:secret' \n " +
			"Set in local-config.json for local dev, or environment variable in the cloud.";
		}
		return values[1];
	}

	cfStrategy = new CloudFoundryStrategy({
		clientID: predixConfig.clientId,
		clientSecret: getSecretFromEncodedString(predixConfig.base64ClientCredential),
		callbackURL: predixConfig.callbackURL,
		uaaURL: predixConfig.uaaURL
	}, refreshStrategy.getOAuth2StrategyCallback() // Create a callback for OAuth2Strategy
	/* TODO: implement if needed.
	function(accessToken, refreshToken, profile, done) {
		token = accessToken;
		done(null, profile);
	}*/);

	passport.use(cfStrategy);
	// Register the OAuth strategy to perform OAuth2 refresh token workflow
	refreshStrategy.useOAuth2Strategy(cfStrategy);

	return passport;
}

function reset() {
	cfStrategy.reset();
}

module.exports = {
	configurePassportStrategy: configurePassportStrategy,
	reset: reset
};

/* eslint-enable no-inline-comments,line-comment-position,capitalized-comments,no-magic-numbers,no-throw-literal */
