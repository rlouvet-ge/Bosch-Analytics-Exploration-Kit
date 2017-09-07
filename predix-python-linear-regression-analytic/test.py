import requests
import time
import datetime
import json

liste = []

def test():

    global liste

    url = "https://analytics-demo-bosch.run.aws-usw02-pr.ice.predix.io/"

    headers = {'cache-control': "no-cache",}

    response = requests.request("GET", url, headers=headers)

    text = json.loads(response.text)
    print("--------------DEBUT----------------")
    print("TIME "+str(datetime.datetime.now()))
    if text['status'] == 'OK':
        print("status "+str(text['status']))
    else:
        print("status "+str(text['status']))
        print("time "+str(text['time']))
        liste.append((str(datetime.datetime.now()),text['status'],text['time']))
        print(liste)
    print("---------------FIN---------------")



while 1==1:
    test()
    with open("result.txt", "a") as myfile:
        if liste != []:
            myfile.write(str(liste))
        myfile.close()
    liste = []
    time.sleep(1)
