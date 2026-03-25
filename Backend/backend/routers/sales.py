from fastapi import APIRouter, Depends, UploadFile, File
from firebase.client import get_db
from firebase_admin import firestore as fs
from routers.auth import get_current_user, require_admin, require_role
import httpx, csv, io, os
from services.email_service import send_admin_reminder
from firebase.cache import invalidate_cache

router = APIRouter(prefix='/sales', tags=['Sales'])
AI_URL = os.getenv('AI_MODEL_URL', 'http://localhost:8001')

@router.get('/')
async def list_sales(date_from:str='', date_to:str='', sku:str='', 
                     category:str='', user=Depends(require_role(['sales_manager']))):
    query = get_db().collection('sales')
    if date_from: query = query.where('date', '>=', date_from)
    if date_to:   query = query.where('date', '<=', date_to)
    docs = [d.to_dict() for d in query.stream()]
    if category: docs = [d for d in docs if d.get('category')==category]
    if sku:      docs = [d for d in docs if d.get('sku')==sku]
    return docs

@router.post('/')
async def record_sale(sale: dict, user=Depends(require_role(['sales_manager']))):
    db = get_db()
    
    # 1. Save the sale record
    sale['recorded_by'] = user['email']
    sale['created_at']  = str(__import__('datetime').datetime.now())
    db.collection('sales').add(sale)
    
    # 2. Decrement stock, increment sales day count
    prod_ref = db.collection('products').document(sale['sku'])
    prod_ref.update({
        'current_stock': fs.Increment(-sale.get('quantity', 1)),
        'sales_day_count': fs.Increment(1)
    })
    
    # 3. Set ml_retrain_needed if sales day count just hit 30
    prod = prod_ref.get().to_dict()
    if prod and prod.get('cold_start') and prod.get('sales_day_count',0) >= 30:
        prod_ref.update({'ml_retrain_needed': True})
        
    # 4. Sync stock to inventory collection
    db.collection('inventory').document(sale['sku']).set({
        'sku':           sale['sku'],
        'current_stock': prod.get('current_stock', 0),
        'lead_time_days':prod.get('lead_time_days', 5),
        'service_level': prod.get('service_level', 0.95)
    }, merge=True)
    
    # 5. Tick warmup tracker in AI Model
    async with httpx.AsyncClient() as client:
        try:
            await client.post(f'{AI_URL}/warmup-tick', 
                              json={'sku': sale['sku'], 'had_sale_today': True})
        except Exception as e:
            print(f"Warning: Failed to reach AI model for warmup tick: {e}")
    # 6. Wipe globally cached data sets
    invalidate_cache('sales', 'products', 'inventory', 'products_active')

    return {'status': 'recorded'}

@router.post('/upload')
async def upload_sales(file: UploadFile=File(...), user=Depends(require_role(['sales_manager']))):
    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode()))
    results = []
    for row in reader:
        try:
            await record_sale(dict(row), user)
            results.append({'sku': row.get('sku'), 'status': 'ok'})
        except Exception as e:
            results.append({'sku': row.get('sku'), 'status': 'error', 'reason': str(e)})
    return {'processed': len(results), 'results': results}

@router.post('/trigger-admin-email')
async def trigger_admin_email(payload: dict):
    days_left = payload.get('days_left', 7)
    success, msg = send_admin_reminder(days_left)
    if success:
        return {'status': 'success', 'message': 'Official reminder securely delivered via Google SMTP.'}
    return {'status': 'error', 'message': msg}

