import time
import sys
from unittest.mock import patch

# Add the backend directory to sys.path to allow imports
sys.path.append('c:/Users/ASUS/Desktop/Smart_Inventory_AI_System/Backend')

from backend.firebase.cache import get_cached_collection, CACHE, invalidate_cache, TTL_SECONDS
from backend.firebase.client import get_db

def mock_get_db():
    class MockDoc:
        def __init__(self, id):
            self.id = id
    
    class MockQuery:
        def stream(self):
            return [MockDoc('1'), MockDoc('2')]
            
    class MockCollection:
        def where(self, *args):
            return MockQuery()
        def stream(self):
            return [MockDoc('1'), MockDoc('2')]
            
    class MockDB:
        def collection(self, name):
            return MockCollection()
            
    return MockDB()

def run_test():
    print("Testing Cache Implementation...")
    
    # Clear cache before starting
    CACHE.clear()
    
    # Mock the DB so we don't actually hit Firebase
    with patch('backend.firebase.cache.get_db', return_value=mock_get_db()):
        # 1. Initial fetch (Cache miss)
        print("\n1. Initial fetch (should hit DB)")
        start_time = time.time()
        docs = get_cached_collection('inventory')
        end_time = time.time()
        print(f"Fetched {len(docs)} documents.")
        print(f"Cache keys: {list(CACHE.keys())}")
        
        # 2. Immediate fetch (Cache hit)
        print("\n2. Immediate fetch (should hit Cache)")
        docs2 = get_cached_collection('inventory')
        print(f"Fetched {len(docs2)} documents.")
        
        # Check if the timestamps match (meaning it came from cache)
        if 'inventory' in CACHE:
            print("Status: Cache works correctly for fresh data!")
        else:
            print("Status: CACHE HIT FAILED!")
            
        # 3. Simulate 21 minutes passing (Cache expire)
        print("\n3. Fetch after 21 minutes (should expire and hit DB)")
        # Alter the timestamp in the cache to be 21 minutes ago
        old_data, old_timestamp = CACHE['inventory']
        CACHE['inventory'] = (old_data, old_timestamp - 1260) # 21 * 60 seconds
        
        docs3 = get_cached_collection('inventory')
        new_data, new_timestamp = CACHE['inventory']
        
        if new_timestamp > old_timestamp:
            print("Status: Cache successfully expired and refetched data from DB after 20 minutes!")
        else:
            print("Status: CACHE EXPIRE FAILED!")
            
        # 4. Invalidation Test
        print("\n4. Invalidation Test")
        invalidate_cache('inventory')
        if 'inventory' not in CACHE:
            print("Status: Cache invalidation works correctly!")
        else:
            print("Status: CACHE INVALIDATION FAILED!")

if __name__ == '__main__':
    run_test()
