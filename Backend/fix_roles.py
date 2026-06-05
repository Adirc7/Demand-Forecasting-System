import sys
import os

# Ensure backend modules can be imported in this repo layout
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

# pyre-ignore[21]
from firebase.client import get_db
# pyre-ignore[21]
from firebase_admin import auth as firebase_auth

mapping = {
    'product@test.com': 'product_manager',
    'forecast@test.com': 'forecast_manager',
    'analyst@test.com': 'report_analyst'
}

print("Running role patch...")
modified = 0
for u in firebase_auth.list_users().users:
    if u.email in mapping:
        role = mapping[u.email]
        firebase_auth.set_custom_user_claims(u.uid, {'admin': False, 'role': role})
        print(f"Updated {u.email} to {role}")
        # pyre-ignore
        modified += 1

print(f"Finished updating {modified} users.")
