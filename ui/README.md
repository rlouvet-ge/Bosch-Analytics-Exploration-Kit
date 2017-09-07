# BCX17 UI

## Features
 * UAA Token management
 * Time Series data rendering in View 1
 * Execute clustering analytic and display the result in 3D
 
## App setup

##### Prerequisite
* node.js (v6 or better) and npm (see https://nodejs.org/en/)
* a browser (chrome 56 is recommended)

##### Install npm dependencies
```
$ npm install
```

##### Install gulp command line interface
```
$ npm install -g gulp-cli
```

##### Configure the application to work on local

To get the configuration from Predix, run the `cf apps` command in your Predix space.
In the output of this command, note the url of the `bcx17-analytics-controller` app.
It should be something like `bcx17-analytics-controller-{random word}.run.aws-usw02-pr.ice.predix.io`.

Go to /server/local-config.json and add:
* the analytics controller url you just got
* the username and password to access ppm that you will find on your team *Practical Information* sheet


##### Run gulp to start a local server
```
$ gulp
```

That should launch several gulp task and at the end you should see:
```
Server is listening at: http://localhost:5000
```

You should now be able to access the sample ui.


## Pushing to Predix

Before pushing your app to Predix you need to run the dist task to process your changes:
```
$ gulp dist
```

Then you can use the cf push command:
```
$ cf push
```

You can also use the push task:
```
$ gulp push
```


