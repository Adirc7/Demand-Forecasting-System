import sys
sys.path.append('c:\\Users\\ASUS\\Desktop\\Smart_Inventory_AI_System\\Backend\\backend')
from firebase.client import get_db

def test():
    db = get_db()
    f = [d.to_dict() for d in db.collection('forecasts').stream()]
    print('Forecasts:', len(f))
    
    if len(f) > 0:
        print('Sample forecast:', f[0])

test()
