import pandas as pd
import numpy as np
from datetime import timedelta
import os

def generate_march():
    base_dir = os.path.join(os.path.dirname(__file__), 'Data sets')
    feb_path = os.path.join(base_dir, 'February_2026_Smart_Inventory.csv')
    march_path = os.path.join(base_dir, 'March_2026_Smart_Inventory.csv')
    
    print(f"Reading from {feb_path}")
    df = pd.read_csv(feb_path)
    
    # Convert date to datetime
    df['date'] = pd.to_datetime(df['date'])
    
    # Add exactly 28 days to make it March!
    df['date'] = df['date'] + timedelta(days=28)
    
    # Add some slight realistic noise to the sales quantity (e.g. +5% growth trend + some noise)
    noise = np.random.normal(1.05, 0.1, size=len(df))
    df['quantity'] = (df['quantity'] * noise).astype(int)
    
    # Prevent negative
    df['quantity'] = df['quantity'].clip(lower=0)
    
    # Update order IDs
    df['order_id'] = df['order_id'].str.replace('FEB26', 'MAR26')
    
    # Randomly shuffle some quantities to ensure it's not a pure copy, increasing learning robustness
    df.to_csv(march_path, index=False)
    print(f"Successfully generated March dataset: {march_path}")
    print(f"Total March rows: {len(df)}")

if __name__ == "__main__":
    generate_march()
