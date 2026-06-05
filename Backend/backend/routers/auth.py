from fastapi import Depends, HTTPException, Header
from firebase.client import verify_token

async def get_current_user(authorization: str = Header(...)):
    token = authorization.replace('Bearer ', '')
    try:
        return verify_token(token)
    except Exception as e:
        print(f"Token verification failed: {e}, auth header: {authorization}")
        raise HTTPException(status_code=401, detail='Invalid or expired token')

async def require_admin(user=Depends(get_current_user)):
    if user.get('role') != 'admin' and not user.get('admin'):
        raise HTTPException(status_code=403, detail='Admin access required')
    return user

def require_role(allowed_roles: list):
    async def role_checker(user=Depends(get_current_user)):
        # Admin ALWAYS gets full access
        if user.get('role') == 'admin' or user.get('admin'):
            return user
            
        current_role = user.get('role', 'staff')
        if current_role not in allowed_roles:
            raise HTTPException(status_code=403, detail=f"Access denied. Required one of: {', '.join(allowed_roles)}")
        return user
    return role_checker
