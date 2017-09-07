"use strict";

// -------------------------------------------
//   Task: Lint all code
// -------------------------------------------
const spawn = require("child_process").spawn;
const gulpUtil = require("gulp-util");

module.exports = function () {
	return function (done) {
		var push = spawn("cf", ["push"]);

		push.stdout.on("data", (data) => {
			gulpUtil.log(data.toString());
		});

		push.stderr.on("data", (data) => {
			gulpUtil.log(data.toString());
		});

		push.on("close", (code) => {
			gulpUtil.log(`cf push exited with code ${code}`);
			done();
		});
	};
};
