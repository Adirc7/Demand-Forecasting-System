from firebase.client import get_db
import httpx, os
from datetime import date

AI_URL = os.getenv('AI_MODEL_URL','http://localhost:8001')

async def run_forecast_generation():
    db = get_db()
    products = [d.to_dict() for d in db.collection('products').where('active','==',True).stream()]
    sku_list = [{
        'sku': p['sku'],
        'category': p['category'],
        'cold_start': p.get('cold_start', True),
        'current_stock': p.get('current_stock', 0),
        'lead_time_days': p.get('lead_time_days', 5)
    } for p in products]
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(f'{AI_URL}/forecast/batch', json={'skus': sku_list})
        forecasts = r.json()
        
    for f in forecasts:
        f['date'] = str(date.today())
        f['category'] = next((p['category'] for p in products if p['sku']==f['sku']), '')
        db.collection('forecasts').document(f['sku']).set(f)
        
    return {'generated': len(forecasts)}
