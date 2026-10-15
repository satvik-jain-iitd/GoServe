#!/usr/bin/env python3
"""First live check of the order API on goserve-dev (F73 d): walks one real order from placed to delivered through the n8n webhook and prints PASS or FAIL for each call.
It WRITES to goserve-dev (one anonymous user, one order, its events, one decision, run rows) and may spend about $0.00002 on one Jev call. Dev only: the address comes from the dev vault names.
Needs the workflows active and the vault (04_integrations.env demo token, 02_databases.env dev keys). Clean up afterwards with scripts/clear_dev.py.
Run: python3 scripts/live_check.py"""
import json, os, re, time, urllib.request, urllib.error, uuid
def vault(f,k):
    m=re.search(r'^'+k+r'=(\S+)',open(os.path.expanduser('~/Desktop/Secrets/'+f)).read(),re.M); return m.group(1)
URL='https://n8n.linkright.in/webhook/gs-order'; TOKEN=vault('04_integrations.env','GOSERVE_DEMO_TOKEN')
SB=vault('02_databases.env','SUPABASE_GOSERVE_DEV_URL'); SK=vault('02_databases.env','SUPABASE_GOSERVE_DEV_SERVICE_ROLE_KEY'); ANON=vault('02_databases.env','SUPABASE_GOSERVE_DEV_ANON_KEY')
def post(body, token=TOKEN):
    h={'content-type':'application/json','User-Agent':'curl/8.7.1'}
    if token: h['x-gs-token']=token
    t=time.time(); req=urllib.request.Request(URL,data=json.dumps(body).encode(),headers=h)
    try: r=urllib.request.urlopen(req,timeout=30); code=r.status; data=json.load(r)
    except urllib.error.HTTPError as e: code=e.code; data=json.loads(e.read() or b'{}')
    return code, data, round((time.time()-t)*1000)
# anonymous user = the session
req=urllib.request.Request(SB+'/auth/v1/signup',data=b'{}',headers={'apikey':ANON,'content-type':'application/json'})
sess=json.load(urllib.request.urlopen(req)); SID=sess['user']['id']; AT=sess['access_token']
out={}
def row(name, res, want):
    code,data,ms=res; ok = code==want
    print(('PASS' if ok else 'FAIL'), name, 'http', code, 'want', want, ms,'ms', json.dumps(data)[:140]); return data
row('no token', post({'action':'health'},token=None), 401)
row('bad action', post({'action':'nope'}), 400)
h=row('health', post({'action':'health'}), 200); print('   jev', h.get('jev'))
menu=json.load(urllib.request.urlopen(urllib.request.Request(SB+'/rest/v1/menu_items?select=id,name,price_paise&limit=2',headers={'apikey':ANON})))
key='live-'+uuid.uuid4().hex
items=[{'menu_item_id':menu[0]['id'],'qty':2}]
p=row('place', post({'action':'place','session_id':SID,'client_order_key':key,'items':items,'address':'Flat 4, Green Park, Delhi'}), 201)
oid=p['order']['id']; print('   total', p['order']['total_paise'], 'expected', 2*menu[0]['price_paise'])
row('place retry same key', post({'action':'place','session_id':SID,'client_order_key':key,'items':items,'address':'Flat 4, Green Park, Delhi'}), 200)
row('skip a step (placed -> ready)', post({'action':'status','session_id':SID,'order_id':oid,'to_status':'ready','actor':'kitchen'}), 409)
for to,actor in [('accepted','kitchen'),('preparing','kitchen'),('ready','kitchen')]:
    row('status '+to, post({'action':'status','session_id':SID,'order_id':oid,'to_status':to,'actor':actor}), 200)
d=row('decide', post({'action':'decide','session_id':SID,'order_id':oid,'riders':[{'id':'r1','free':True,'distance_m':1800,'trips_done':3},{'id':'r2','free':True,'distance_m':900,'trips_done':1},{'id':'r3','free':False,'distance_m':400,'trips_done':0}]}), 200)
dec=d['decision']; print('   rule', dec['rule_pick'], 'jev', dec['jev'], 'status', dec['jev_status'], 'chosen', dec['chosen_pick'])
row('status out_for_delivery', post({'action':'status','session_id':SID,'order_id':oid,'to_status':'out_for_delivery','actor':'rider'}), 200)
row('arriving event', post({'action':'event','session_id':SID,'order_id':oid,'event':'order.arriving','actor':'rider'}), 200)
row('arriving again -> already done', post({'action':'event','session_id':SID,'order_id':oid,'event':'order.arriving','actor':'rider'}), 409)
row('status delivered', post({'action':'status','session_id':SID,'order_id':oid,'to_status':'delivered','actor':'rider'}), 200)
time.sleep(3)
def rest(path, key=SK, tok=None):
    h={'apikey':key,'Authorization':'Bearer '+(tok or key)}
    return json.load(urllib.request.urlopen(urllib.request.Request(SB+'/rest/v1/'+path,headers=h)))
ev=rest('order_events?select=event,actor&order_id=eq.'+oid+'&order=id')
print('events', [e['event'] for e in ev])
runs=rest('run_log?select=workflow,duration_ms,error,cost&session_id=eq.'+SID+'&order=created_at')
print('run_log rows', len(runs), [(r['workflow'].split(': ')[1], r['duration_ms'], r['error']) for r in runs])
print('decision rows', len(rest('decision_log?select=id&session_id=eq.'+SID)))
# the phone's own view: the signed-in session reads its decision and runs
print('phone reads decisions', len(rest('decision_log?select=id', key=ANON, tok=AT)), 'runs', len(rest('run_log?select=id', key=ANON, tok=AT)))
print('SESSION', SID, 'ORDER', oid)
