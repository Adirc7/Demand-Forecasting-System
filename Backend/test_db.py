import sys
import os
import asyncio

sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
# pyre-ignore[21]
from firebase.client import get_db

def main():
    db = get_db()
    products_all = list(db.collection('products').stream())
    print(f"Total Products in DB: {len(products_all)}")
    # pyre-ignore
    for p in products_all[:5]:
        print(f"{p.id}: {p.to_dict()}")

    inventory_all = list(db.collection('inventory').stream())
    print(f"Total Inventory records in DB: {len(inventory_all)}")
    # pyre-ignore
    for i in inventory_all[:5]:
        print(f"{i.id}: {i.to_dict()}")

main()
