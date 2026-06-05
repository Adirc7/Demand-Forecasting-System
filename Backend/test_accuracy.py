import sys
import asyncio
sys.path.append('c:\\Users\\ASUS\\Desktop\\Smart_Inventory_AI_System\\Backend\\backend')
from services.report_service import compute_accuracy, compute_business_metrics

async def test():
    try:
        acc = await compute_accuracy()
        print('ACCURACY REPORT:')
        print(acc)
    except Exception as e:
        print('ACCURACY ERROR:', str(e))
        
    try:
        biz = await compute_business_metrics()
        print('BUSINESS REPORT:')
        print('EST_RESTOCK:', biz.get('est_restock_cost'))
        print('DEAD_STOCK:', biz.get('dead_stock'))
    except Exception as e:
        print('BIZ ERROR:', str(e))

asyncio.run(test())
