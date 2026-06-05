import os
import sys
import csv

sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
try:
    # pyre-ignore[21]
    from firebase.client import get_db
except ImportError as e:
    print('ImportError:', e)
    sys.exit(1)

def seed_missing_skus():
    db = get_db()
    print("Fetching existing SKUs from Firebase...")
    product_docs = db.collection('products').stream()
    fb_skus = {doc.id for doc in product_docs}
    print(f"Found {len(fb_skus)} existing SKUs.")

    data_dir = os.path.join(os.path.dirname(__file__), '..', 'AI-Model', 'Data sets')
    missing_items = {} # sku -> dict data
    
    # Process all CSV files and store the first valid row for any missing SKU
    for f in os.listdir(data_dir):
        if f.endswith('.csv'):
            with open(os.path.join(data_dir, f), 'r', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                for row in reader:
                    sku = row.get('sku')
                    if sku and sku not in fb_skus and sku not in missing_items:
                        category = row.get('category')
                        missing_items[sku] = {
                            'sku': sku,
                            'category': category,
                            'product_name': row.get('product_name') or f"{category} Product {sku}",
                            'price': float(row.get('amount', 0)),
                            'current_stock': int(row.get('current_stock', 0)),
                            'lead_time_days': int(row.get('lead_time_days', 5)),
                            'active': True,
                            'cold_start': False, 
                        }

    total_missing = len(missing_items)
    print(f"Found {total_missing} missing SKUs across CSVs to import.")
    
    if total_missing == 0:
        print("Nothing to import!")
        return

    print("Importing step-by-step using Firestore Batches (up to 500 per batch)...")
    
    # Firestore allows up to 500 writes per batch. We'll use batches of 100 for safety.
    batch_size = 100
    items = list(missing_items.values())
    
    for i in range(0, len(items), batch_size):
        # pyre-ignore
        chunk = items[i:i + batch_size]
        batch = db.batch()
        
        for item in chunk:
            sku = item['sku']
            # Create product reference
            prod_ref = db.collection('products').document(sku)
            batch.set(prod_ref, item, merge=True)
            
            # Create inventory reference
            inv_ref = db.collection('inventory').document(sku)
            batch.set(inv_ref, {
                'sku': sku,
                'current_stock': item['current_stock'],
                'last_updated': '2025-10-01'
            }, merge=True)
            
        # Commit the transaction batch
        batch.commit()
        print(f"Successfully committed batch {min(i + batch_size, total_missing)} / {total_missing}")

    print("\nAll missing SKUs have been updated successfully step-by-step!")

if __name__ == "__main__":
    seed_missing_skus()
