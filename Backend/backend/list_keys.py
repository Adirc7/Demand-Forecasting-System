import os
import sys

sys.path.append(os.getcwd())
from dotenv import load_dotenv
load_dotenv()
from firebase.client import get_db

def list_keys():
    db = get_db()
    
    print("--- INVENTORY KEYS ---")
    for doc in db.collection('inventory').stream():
        if '1008' in doc.id or '1017' in doc.id:
            print(f"ID: '{doc.id}' -> {doc.to_dict()}")

    print("\n--- PRODUCT KEYS ---")
    for doc in db.collection('products').stream():
        if '1008' in doc.id or '1017' in doc.id:
            print(f"ID: '{doc.id}' -> {doc.to_dict()}")

if __name__ == "__main__":
    list_keys()
