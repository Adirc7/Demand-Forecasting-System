import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime

cred = credentials.Certificate("serviceAccountKey.json")
try:
    firebase_admin.get_app()
except ValueError:
    firebase_admin.initialize_app(cred)
db = firestore.client()

print("="*40)
print("Checking Alerts Collection")
alerts = db.collection('alerts').order_by('created_at', direction=firestore.Query.DESCENDING).limit(10).stream()
alert_list = list(alerts)
if not alert_list:
    print("No alerts found.")
for a in alert_list:
    d = a.to_dict()
    print(f"Date: {d.get('created_at')}, SKU: {d.get('sku')}, Level: {d.get('level')}, Message: {d.get('message')}")

print("\n"+"="*40)
print("Checking Sales Collection for March")
sales = db.collection('sales').where('date', '>=', '2026-03-01').where('date', '<', '2026-04-01').limit(5).stream()
sales_list = list(sales)
if not sales_list:
    print("No March sales found.")
else:
    for s in sales_list:
        d = s.to_dict()
        print(f"Sale Date: {d.get('date')}, SKU: {d.get('sku')}, Qty: {d.get('quantity')}")
