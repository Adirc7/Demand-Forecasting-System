from fastapi import APIRouter, Depends
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
    get_db().collection('inventory').document(product_id).update(data)
    if 'current_stock' in data:
        get_db().collection('products').document(product_id).update(
            {'current_stock': data['current_stock']})
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
