from __future__ import print_function # In python 2.7
from flask import Flask, abort, request, g, render_template, jsonify

import os
import re
import base64
import json
import requests
import sys
import websocket
import StringIO
import pandas
import math
from websocket import create_connection
from datetime import datetime
from sklearn.linear_model import LinearRegression


import ConfigParser

app = Flask(__name__)
app.debug = True

XDK_SAMPLING_RATE = 0.005 #In milliseconds
NB_SAMPLES = 600 #Default 600 value equals 3 seconds divided by 5 milliseconds samples
THRESHOLD = 5 #Filter opening, in mm
SLOPE_THRESHOLD = 0.0004
SCORE_THRESHOLD = 0.70
CLOUD_CONTEXT = os.environ.has_key('VCAP_APP_PORT')

if CLOUD_CONTEXT:
    port = int(os.getenv("VCAP_APP_PORT"))
    appEnv = json.loads(os.getenv("VCAP_APPLICATION"))
    appSvc = json.loads(os.getenv("VCAP_SERVICES"))

    BASE_URI = "https://" + appEnv['application_uris'][0]
    CLIENT_ID = os.getenv("clientId")
    CLIENT_SECRET_CREDENTIAL = os.getenv("base64ClientCredential")
    UAA_URI = appSvc['predix-uaa'][0]['credentials']['uri']
    UAA_ISSUERID = appSvc['predix-uaa'][0]['credentials']['issuerId']
    TS_URI = appSvc['predix-timeseries'][0]['credentials']['query']['uri']
    TS_ZONE = appSvc['predix-timeseries'][0]['credentials']['query']['zone-http-header-value']
    TIME_WINDOW = int(os.getenv("timeWindow"))


else:
    port = int(os.getenv("PORT", "5001"))
    config = ConfigParser.ConfigParser()
    config_path = os.path.join(os.getcwd(), "config.ini")
    config.read(config_path)

    CLIENT_ID = config.get("PredixServices", "CLIENT_ID")
    CLIENT_SECRET_CREDENTIAL = config.get("PredixServices", "CLIENT_SECRET_CREDENTIAL")
    #UAA_URI = config.get("PredixServices", "UAA_URI")
    UAA_ISSUERID =config.get("PredixServices", "UAA_ISSUERID")
    TS_URI = config.get("PredixServices", "TS_URI")
    TS_ZONE = config.get("PredixServices", "TS_ZONE")
    TIME_WINDOW = int(config.get("PredixServices", "TIME_WINDOW"))

if TIME_WINDOW != 0:
    if XDK_SAMPLING_RATE != 0:
        NB_SAMPLES = math.ceil(TIME_WINDOW / XDK_SAMPLING_RATE)


@app.route("/", methods=['GET'])
def launch_process():
    print("Starting: launch_process")

    print("CLIENT_SECRET_CREDENTIAL"+str(CLIENT_SECRET_CREDENTIAL))
    print("TS_ZONE"+str(TS_ZONE))
    print("TS_URI"+str(TS_URI))

    # values,time = getLatestDatapoints()
    # if len(values) == 15 and len(time) == 15:
    #     slope,score = launch_analytics(values,time)
    #     return "SLOPE "+str(slope)+" SCORE"+str(score)
    values, time = getLatestDatapoints()
    if len(values) == NB_SAMPLES and len(time) == NB_SAMPLES:
        return launch_analytics(pandas.Series(values).reshape(int(NB_SAMPLES),1),pandas.Series(time).reshape(int(NB_SAMPLES),1))
    else:
        return "ERROR"

def launch_analytics(values,time):
    # img = StringIO.StringIO()
    # y = [1,2,3,4,5]
    # x = [0,2,1,3,4]

    # plt.plot(x,y)
    # plt.savefig(img, format='png')
    # img.seek(0)

    # plot_url = base64.b64encode(img.getvalue())
    print("values "+str(values))
    print("time "+str(time))
    reg = LinearRegression()
    reg.fit(time,values)
    slope = reg.coef_
    score = reg.score(time,values)
    print("slope "+str(slope))
    print("score "+str(score))
    if abs(slope) > SLOPE_THRESHOLD and score > SCORE_THRESHOLD:
        tps = (((values[NB_SAMPLES - 1]- THRESHOLD)/(abs(slope))) / 1000)[0][0]
        return jsonify({'status':'KO','time':tps})#"test1.html",tps
    else:
        return jsonify({'status':'OK'})



def getLatestDatapoints():
    print("Starting: getLatestDatapoints")
    access_token = getToken()

    url = TS_URI

    headers = {
        'authorization': "Bearer %s" % access_token,
        'predix-zone-id': TS_ZONE
    }

    payload = "{\"start\": \"1y-ago\",\"tags\": [{\"name\": \"SimsterFilterA:filterOpening:none\",\"order\": \"desc\",\"limit\": " + str(NB_SAMPLES) + "}]}"

    response = requests.request("POST", url, headers=headers, data=payload)
    dataPoints = json.loads(response.content)
    dataPoints = dataPoints['tags'][0]['results'][0]['values']
    print(dataPoints)
    time = []
    timeOLD = []
    values = []
    for i in dataPoints:
        time.insert(len(time),i[0])
        #timeOLD.append(i[0])
        values.insert(len(time),i[1])
    time = list(reversed(time))
    values = list(reversed(values))
    #print("-----------")
    #print(timeOLD)
    if len(time) < NB_SAMPLES and len(values) < NB_SAMPLES:
        time = []
        values = []
    return values,time

def getToken():
    url = UAA_ISSUERID

    payload = "grant_type=client_credentials"
    headers = {
                   'authorization': "Basic "+CLIENT_SECRET_CREDENTIAL,
                   'cache-control': "no-cache",
                   'content-type': "application/x-www-form-urlencoded"
                   }

    response = requests.request("POST", url, data=payload, headers=headers)

    token=json.loads(response.text)['access_token']
    print('token OK')

    return token

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=port, debug=True)
    logger.setLevel(logging.DEBUG)
