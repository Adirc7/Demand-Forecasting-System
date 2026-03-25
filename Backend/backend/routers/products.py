from fastapi import APIRouter, Depends, HTTPException  # type: ignore
from firebase.client import get_db  # type: ignore
from firebase.cache import invalidate_cache, get_cached_collection
from routers.auth import get_current_user, require_admin, require_role  # type: ignore
from schemas.models import ProductCreate, ProductUpdate  # type: ignore
import httpx  # type: ignore
import os
import datetime
router = APIRouter(prefix='/products', tags=['Products'])
AI_URL = os.getenv('AI_MODEL_URL', 'http://localhost:8001')

@router.get('/')
async def list_products(page:int=1, limit:int=20, search:str='',
                        category:str='', user=Depends(get_current_user)):
    docs = [d.to_dict() for d in get_cached_collection('products_active')]
    if category: docs = [d for d in docs if d.get('category') == category]
    if search: docs = [d for d in docs if search.lower() in d.get('product_name','').lower()]
    start = (page-1)*limit
    return {'data': docs[start:start+limit], 'total': len(docs), 'page': page}  # type: ignore

@router.post('/')
async def create_product(product: ProductCreate, user=Depends(require_role(['product_manager']))):
    db = get_db()
    if db.collection('products').document(product.sku).get().exists:
        raise HTTPException(400, 'SKU already exists')
    doc = {
        **product.dict(),
        'current_stock':    product.opening_stock,
        'cold_start':       True,   # ALWAYS True on creation
        'sales_day_count':  0,      # ALWAYS 0 on creation
        'ml_retrain_needed':False,  # ALWAYS False on creation
        'active':           True,
        'registered_by':    user['email'],
        'registered_date':  str(datetime.date.today()),
    }
    db.collection('products').document(product.sku).set(doc)
    async with httpx.AsyncClient() as client:
        await client.post(f'{AI_URL}/register-sku', 
                          json={'sku': product.sku, 'category': product.category})
                          
    invalidate_cache('products', 'products_active')
    return {'status': 'created', 'sku': product.sku, 'cold_start': True}

@router.get('/stock-advice')
async def stock_advice(category:str, lead_time_days:int, 
                       user=Depends(get_current_user)):
    async with httpx.AsyncClient() as client:
        r = await client.post(f'{AI_URL}/stock-advice', 
                              json={'category':category,'lead_time_days':lead_time_days})
    return r.json()

@router.put('/{sku}')
async def update_product(sku:str, update:ProductUpdate, user=Depends(require_role(['product_manager']))):
    # safe filter blocks ML flags (Admin)
    safe = {k:v for k,v in update.dict(exclude_unset=True).items() 
            if k not in ('cold_start','sales_day_count','ml_retrain_needed')}
    get_db().collection('products').document(sku).update(safe)
    invalidate_cache('products', 'products_active')
    return {'status': 'updated'}

@router.delete('/{sku}')
async def delete_product(sku:str, user=Depends(require_role(['product_manager']))):
    # safe soft delete
    get_db().collection('products').document(sku).update({'active': False})
    invalidate_cache('products', 'products_active')
    return {'status': 'deleted'}

@router.post('/internal/graduate')
async def graduate_sku(body: dict):
    # no user auth - internal only called by AI Model after retrain
    sku = body.get('sku')
    get_db().collection('products').document(sku).update({
        'cold_start': False, 'ml_retrain_needed': False })
    return {'status': 'graduated', 'sku': sku}
