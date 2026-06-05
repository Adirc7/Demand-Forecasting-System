from fastapi import APIRouter, Depends
from firebase.client import get_db
from firebase_admin import auth as firebase_auth
from routers.auth import require_admin
router = APIRouter(prefix='/admin', tags=['Admin'])

@router.get('/users')
async def list_users(user=Depends(require_admin)):
    users = []
    for u in firebase_auth.list_users().users:
        role = 'staff'
        if u.custom_claims:
            role = u.custom_claims.get('role') or ('admin' if u.custom_claims.get('admin') else 'staff')
        users.append({'uid':u.uid,'email':u.email,
            'role': role,
            'active': not u.disabled })
    return users

@router.post('/users')
async def create_user(data:dict, user=Depends(require_admin)):
    new_user = firebase_auth.create_user(email=data['email'],password=data['password'])
    role = data.get('role', 'staff')
    firebase_auth.set_custom_user_claims(new_user.uid, {'admin': role == 'admin', 'role': role})
    return {'uid': new_user.uid, 'email': new_user.email}

@router.put('/users/{uid}')
async def update_user(uid:str, data:dict, user=Depends(require_admin)):
    if 'role' in data:
        role = data['role']
        firebase_auth.set_custom_user_claims(uid, {'admin': role == 'admin', 'role': role})
    if 'active' in data:
        firebase_auth.update_user(uid, disabled=not data['active'])
    return {'status':'updated'}

@router.delete('/users/{uid}')
async def deactivate_user(uid:str, user=Depends(require_admin)):
    firebase_auth.update_user(uid, disabled=True)
    return {'status':'deactivated'}

@router.get('/settings')
async def get_settings(user=Depends(require_admin)):
    doc = get_db().collection('settings').document('system').get()
    return doc.to_dict() if doc.exists else {}

@router.put('/settings/session-timeout')
async def update_session_timeout(data:dict, user=Depends(require_admin)):
    get_db().collection('settings').document('system').set(
        {'session_timeout_minutes': data['minutes']}, merge=True)
    return {'status':'updated'}

@router.put('/settings/safety-factor')
async def update_safety_factor(data:dict, user=Depends(require_admin)):
    get_db().collection('categories').document(data['category']).update(
        {'safety_factor': data['safety_factor']})
    return {'status':'updated'}
