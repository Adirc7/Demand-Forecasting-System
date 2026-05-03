from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
import uuid
from firebase.client import get_db
from routers.auth import get_current_user, require_role
from services.alert_service import generate_alerts
from firebase.cache import invalidate_cache, get_cached_collection

router = APIRouter(prefix='/inventory', tags=['Inventory'])

@router.get('/')
async def get_all_inventory(user=Depends(get_current_user)):
    return [d.to_dict() for d in get_cached_collection('inventory')]

@router.put('/{product_id}')
async def update_inventory(product_id:str, data:dict, user=Depends(require_role(['inventory_manager']))):
    inv_data = {k:v for k,v in data.items() if k != 'unit_price'}
    if inv_data:
        get_db().collection('inventory').document(product_id).update(inv_data)
        
    product_update = {}
    if 'current_stock' in data:
        product_update['current_stock'] = data['current_stock']
    if 'unit_price' in data:
        product_update['unit_price'] = float(data['unit_price'])
        
    if product_update:
        get_db().collection('products').document(product_id).update(product_update)
        invalidate_cache('products_active', 'products')
        
    invalidate_cache('inventory')
    return {'status': 'updated'}

@router.get('/alerts')
async def get_alerts(user=Depends(get_current_user)):
    return await generate_alerts()

@router.post('/alerts/{alert_id}/override')
async def set_override_threshold(alert_id:str, data:dict, user=Depends(require_role(['inventory_manager']))):
    threshold = data.get('reorder_point')
    if threshold is None:
        return {'status': 'error', 'msg': 'Missing reorder_point in payload'}
    get_db().collection('thresholds').document(alert_id).set(
        {'reorder_point': threshold, 'set_by': user['email']}, merge=True)
    invalidate_cache('thresholds')
    return {'status': 'success'}

@router.post('/alerts/{alert_id}/acknowledge')
async def acknowledge_alert(alert_id:str, user=Depends(require_role(['inventory_manager']))):
    get_db().collection('inventory').document(alert_id).set(
        {'acknowledged': True, 'acknowledged_by': user['email']}, merge=True)
    invalidate_cache('inventory')
    return {'status': 'acknowledged'}

@router.post('/{product_id}/adjust')
async def adjust_inventory(product_id:str, data:dict, user=Depends(require_role(['inventory_manager']))):
    new_stock = data.get('new_stock')
    reason = data.get('reason')
    
    if new_stock is None or type(new_stock) is not int or new_stock < 0:
        raise HTTPException(status_code=400, detail="Invalid new_stock provided. Must be a non-negative integer.")
        
    doc = get_db().collection('inventory').document(product_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Product not found in inventory.")
        
    old_stock = doc.to_dict().get('current_stock', 0)
    
    # 1. Write Audit Log
    adj_id = str(uuid.uuid4())
    get_db().collection('stock_adjustments').document(adj_id).set({
        'product_id': product_id,
        'old_stock': old_stock,
        'new_stock': new_stock,
        'reason': reason or 'Manual correction',
        'adjusted_by': user['email'],
        'timestamp': datetime.utcnow().isoformat() + 'Z'
    })
    
    # 2. Update stock physically
    get_db().collection('inventory').document(product_id).update({'current_stock': new_stock, 'acknowledged': False})
    get_db().collection('products').document(product_id).update({'current_stock': new_stock})
    
    # Invalidate caches
    invalidate_cache('products_active', 'products', 'inventory')
    return {'status': 'adjusted', 'new_stock': new_stock}
