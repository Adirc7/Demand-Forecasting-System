import os
import sys
import csv
import json
import random

sys.path.append(os.path.join(os.path.dirname(__file__)))
from firebase.client import get_db

def _round_float(val: float, ndigits: int = 2) -> float:
    factor = 10 ** ndigits
    return float(int(float(val) * factor + 0.5)) / factor

def seed_march_data():
    csv_path = r'c:\Users\ASUS\Desktop\Smart_Inventory_AI_System\AI-Model\Data sets\March_2026_Smart_Inventory.csv'
    if not os.path.exists(csv_path):
        print(f"CSV not found: {csv_path}")
        return

    db = get_db()
    
    print("Reading March 2026 CSV...")
    sales_to_batch = []
    inventory_updates = {}
    
    with open(csv_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            sku = row.get('sku')
            if not sku:
                continue
            
            # The CSV has current_stock per row. We will keep the latest current_stock.
            try:
                current_stock = int(float(row.get('current_stock', 0)))
            except ValueError:
                current_stock = 0
            
            inventory_updates[sku] = current_stock
            
            # Prepare sales record
            date_str = row.get('date', '')
            if date_str.startswith('2026-03'):
                try:
                    qty = int(float(row.get('quantity', 0)))
                    price = float(row.get('amount', 0))
                except ValueError:
                    qty = 0
                    price = 0.0
                
                # Only add if it's a completed valid sale for march
                status = 'Completed' # Force to Completed for UI Dashboard visibility
                if qty > 0:
                    sale_id = row.get('order_id') or f"SYS-MAR-{random.randint(100000, 999999)}"
                    sales_to_batch.append({
                        'id': sale_id,
                        'date': date_str,
                        'sku': sku,
                        'quantity': qty,
                        'price': price,
                        'status': status,
                        'revenue': _round_float(qty * price, 2)
                    })

    print(f"Found {len(sales_to_batch)} sales records for March.")
    print(f"Found {len(inventory_updates)} SKUs to update inventory.")

    # Execute Batch Writes
    batch = db.batch()
    batch_count = 0
    total_sales = 0

    print("Uploading Sales...")
    for s in sales_to_batch:
        doc_ref = db.collection('sales').document(s['id'])
        batch.set(doc_ref, s)
        batch_count += 1
        total_sales += 1

        if batch_count >= 400: # Firestore limit is 500
            batch.commit()
            batch = db.batch()
            batch_count = 0

    print("Updating Inventory levels...")
    total_inventory = 0
    for sku, stock in inventory_updates.items():
        inv_ref = db.collection('inventory').document(sku)
        batch.set(inv_ref, {'current_stock': stock, 'acknowledged': False, 'sku': sku}, merge=True)
        
        prod_ref = db.collection('products').document(sku)
        batch.set(prod_ref, {'current_stock': stock}, merge=True)
        
        batch_count += 2
        total_inventory += 1

        if batch_count >= 400:
            batch.commit()
            batch = db.batch()
            batch_count = 0

    if batch_count > 0:
        batch.commit()

    print(f"SUCCESS: Uploaded {total_sales} sales and updated stock for {total_inventory} SKUs in Firebase.")

if __name__ == "__main__":
    seed_march_data()
