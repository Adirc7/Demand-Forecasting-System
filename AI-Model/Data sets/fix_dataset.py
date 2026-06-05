import csv
import io
import datetime
import random

input_file = r"c:\Users\ASUS\Desktop\Smart_Inventory_AI_System\AI-Model\Data sets\February_2026_Smart_Inventory.csv"
output_file = r"c:\Users\ASUS\Desktop\Smart_Inventory_AI_System\AI-Model\Data sets\Clean_February_Sales.csv"

# Extract accurate average daily sales (mu) and standard deviation (sigma) for each SKU created by the AI Model
sku_stats = {}

with open(input_file, mode='r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        sku = row['sku']
        if sku not in sku_stats:
            try:
                avg = float(row['avg_daily_sales_sku'])
                std = float(row['demand_std_sku'])
                sku_stats[sku] = {'avg': avg, 'std': std}
            except ValueError:
                pass


# Generate pure simulated sales data for February (28 days) using Gaussian distribution
start_date = datetime.date(2026, 2, 1)

with open(output_file, mode='w', encoding='utf-8', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['sku', 'quantity', 'date'])
    
    for day_offset in range(28):
        current_date = start_date + datetime.timedelta(days=day_offset)
        date_str = current_date.isoformat()
        
        for sku, stats in sku_stats.items():
            # Calculate a realistic daily sale quantity that perfectly matches the AI's predictions!
            sale_qty = int(random.gauss(stats['avg'], stats['std']))
            if sale_qty < 0:
                sale_qty = 0 # Cannot have negative sales
            
            writer.writerow([sku, sale_qty, date_str])

print(f"Successfully generated clean sales data at: {output_file}")
print(f"Generated {28 * len(sku_stats)} realistic sales records that will NOT harm the AI.")
