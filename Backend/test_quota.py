import sys, asyncio
sys.path.append('c:\\Users\\ASUS\\Desktop\\Smart_Inventory_AI_System\\Backend\\backend')
from services.report_service import export_training_csv

async def test():
    try:
        csv_str, m = await export_training_csv()
        print('SUCCESS! Month detected:', m)
        print('Lines generated:', len(csv_str.splitlines()))
        
        # Test basic db call
        from firebase.client import get_db
        docs = list(get_db().collection('products').limit(1).stream())
        print('DB PING OK.', docs[0].id)
    except Exception as e:
        print('ERROR:', str(e))

asyncio.run(test())
