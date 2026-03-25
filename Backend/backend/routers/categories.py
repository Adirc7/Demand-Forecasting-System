from fastapi import APIRouter, Depends
from firebase.client import get_db
from routers.auth import get_current_user, require_admin

router = APIRouter(prefix='/categories', tags=['Categories'])

@router.get('/')
async def list_categories(user=Depends(get_current_user)):
    return [d.to_dict() for d in get_db().collection('categories').stream()]

@router.post('/')
async def create_category(data:dict, user=Depends(require_admin)):
    ref = get_db().collection('categories').document()
    ref.set({**data, 'id': ref.id})
    return {'id': ref.id}

@router.put('/{category_id}')
async def update_category(category_id:str, data:dict, user=Depends(require_admin)):
    get_db().collection('categories').document(category_id).update(data)
    return {'status': 'updated'}

@router.delete('/{category_id}')
async def delete_category(category_id:str, user=Depends(require_admin)):
    get_db().collection('categories').document(category_id).delete()
    return {'status': 'deleted'}
