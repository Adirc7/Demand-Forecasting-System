import os
import sys
import asyncio

sys.path.append(os.getcwd())
from dotenv import load_dotenv
load_dotenv()
from firebase.client import get_db

def drain_stock():
    db = get_db()
    # Find dc-1008 and reduce its current_stock to 1 to trigger a critical alert
    sku = 'DC-1008'
    
    # Update inventory collection
    inv_ref = db.collection('inventory').document(sku)
    if inv_ref.get().exists:
        inv_ref.update({'current_stock': 0})
    else:
        inv_ref.set({'current_stock': 0})
        
    # Update products collection
    prod_ref = db.collection('products').document(sku)
    if prod_ref.get().exists:
        prod_ref.update({'current_stock': 0})

    # Update thresholds collection to ensure rp is high enough
    thr_ref = db.collection('thresholds').document(sku)
    if thr_ref.get().exists:
        thr_ref.update({'reorder_point': 50})
    else:
        thr_ref.set({'reorder_point': 50})
        
    print(f"Successfully drained {sku} stock to 0 and boosted reorder point to force a Gemini AI Reorder alert!")

if __name__ == "__main__":
    drain_stock()
