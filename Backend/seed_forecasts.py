import sys
import os
import csv
from datetime import datetime
import asyncio

# Attach backend path to access Firebase correctly
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
from firebase.client import get_db  # type: ignore

csv_path = r"c:\Users\ASUS\Desktop\Smart_Inventory_AI_System\AI-Model\dropex_output_v3\reorder_report_v3.csv"

def run_injection():
    print("="*60)
    print("  DROPEX AI FORECAST INJECTION PIPELINE")
    print("="*60)
    
    db = get_db()
    
    if not os.path.exists(csv_path):
        print(f"❌ Error: Could not find the AI output file at {csv_path}")
        return

    print("📚 Reading AI predictions from CSV...")
    
    skus_processed = 0
    batch = db.batch()
    batch_count = 0
    
    with open(csv_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            sku = row['sku']
            avg_daily_demand = float(row['avg_daily_demand'])
            
            # Create the exact payload that alert_service.py is looking for!
            payload = {
                'sku': sku,
                'forecast_30d': round(avg_daily_demand * 30.0, 2),  # type: ignore
                'forecast_7d': round(avg_daily_demand * 7.0, 2),  # type: ignore
                'confidence': 'HIGH',
                'is_cold': False,
                'last_updated': datetime.utcnow().isoformat()
            }
            
            # Use merge=True so we don't accidentally delete other fields if they exist
            doc_ref = db.collection('forecasts').document(sku)
            batch.set(doc_ref, payload, merge=True)
            
            skus_processed += 1
            batch_count += 1
            
            # Firebase batches support up to 500 operations. 
            # We commit every 400 just to be incredibly safe.
            if batch_count >= 400:
                batch.commit()
                print(f"  ✅ Sent batch of {batch_count} records to Google Firebase...")
                batch = db.batch()
                batch_count = 0
                
    # Commit any remaining records
    if batch_count > 0:
        batch.commit()
        print(f"  ✅ Sent final batch of {batch_count} records to Google Firebase...")
        
    print("\n" + "="*60)
    print(f"🎉 INJECTION COMPLETE: Safely pushed {skus_processed} AI Predictions to Firebase!")
    print("Your website's 'Forecasts' and 'Alerts' dashboards are now perfectly synced.")
    print("="*60)

if __name__ == "__main__":
    try:
        run_injection()
    except Exception as e:
        print("\n❌ INJECTION FAILED!")
        print("Note: If you received a '429 Quota Exceeded' error, it means Google has not")
        print("lifted the database lock yet. Please wait until 12:30 PM and try again.")
        print(f"Exact error: {e}")
