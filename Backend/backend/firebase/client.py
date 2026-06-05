# pyre-ignore-all-errors
# type: ignore
import firebase_admin
from firebase_admin import credentials, firestore, auth as firebase_auth
import os

# Build the absolute path to where the key is actually located in backend/
current_dir = os.path.dirname(os.path.abspath(__file__))
key_path = os.path.join(current_dir, '..', 'serviceAccountKey.json')

cred = credentials.Certificate(key_path)
# Avoid re-initializing Firebase app when this module is imported multiple times (e.g. in pytest collection)
try:
    firebase_admin.get_app()
except ValueError:
    firebase_admin.initialize_app(cred)


def get_db():
    return firestore.client()

def verify_token(token):
    return firebase_admin.auth.verify_id_token(token, clock_skew_seconds=60)
