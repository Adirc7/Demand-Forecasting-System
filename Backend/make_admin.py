import sys
import os

# Ensure backend modules can be imported
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from firebase.client import get_db
from firebase_admin import auth as firebase_auth

email_to_make_admin = 'aadithyabanda@gmail.com'
print(f"Attempting to give Admin access to {email_to_make_admin}...")

try:
    user = firebase_auth.get_user_by_email(email_to_make_admin)
    firebase_auth.set_custom_user_claims(user.uid, {'admin': True, 'role': 'admin'})
    print(f"SUCCESS: Successfully granted Admin privileges to {email_to_make_admin}")
except firebase_auth.UserNotFoundError:
    print(f"NOT_FOUND: User {email_to_make_admin} does not exist in Firebase yet. Please add them.")
except Exception as e:
    print(f"ERROR: {e}")
