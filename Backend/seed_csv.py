import os
import sys
import csv

sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
# pyre-ignore[21]
from firebase.client import get_db

def seed_db():
    csv_path = r'c:\Users\ASUS\Desktop\Smart_Inventory_AI_System\AI-Model\Data sets\October_2025_Smart_Inventory.csv'
    if not os.path.exists(csv_path):
        print(f"CSV not found: {csv_path}")
        return

    db = get_db()
    with open(csv_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        count = 0
        seen_skus = set()
        for row in reader:
            sku = row.get('sku')
            if not sku or sku in seen_skus:
                continue

            category = row.get('category')
            product_name = row.get('product_name') or f"{category} Product {sku}"
            price = float(row.get('amount', 0)) # using amount as proxy for price? or 0
            current_stock = int(row.get('current_stock', 0))
            lead_time = int(row.get('lead_time_days', 5))

            # In products collection
            db.collection('products').document(sku).set({
                'sku': sku,
                'category': category,
                'product_name': product_name,
                'price': price,
                'current_stock': current_stock,
                'lead_time_days': lead_time, 
                'active': True,
                'cold_start': False, 
            }, merge=True)

            # In inventory collection
            db.collection('inventory').document(sku).set({
                'sku': sku,
                'current_stock': current_stock,
                'last_updated': '2025-10-01'
            }, merge=True)

            seen_skus.add(sku)
            count += 1
            if count >= 30: # Limit inserts for testing so it's fast
                break

        print(f"Seeded {count} unique products and inventory records.")

seed_db()
