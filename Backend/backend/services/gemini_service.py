from google import genai  # type: ignore
import os
import traceback
import asyncio

FALLBACK = 'Stock level has fallen below the safety reorder point.'

async def explain_alert(sku, product_name, category, stock, rp, forecast_7d) -> str:
    try:
        prompt = f'''You are an inventory manager AI.
Product: {product_name} in category {category}.
Current stock: {stock} units. Reorder point: {rp}. 7-day forecast: {forecast_7d} units.
Write exactly 2 plain-English sentences explaining why this product needs reordering.
No bullet points. No markdown. Just two natural sentences.'''
        if not os.getenv('GEMINI_API_KEY'):
            print("Gemini API Error: GEMINI_API_KEY is not set in the environment.")
            return FALLBACK
            
        client = genai.Client(api_key=os.getenv('GEMINI_API_KEY'))
        
        def _fetch():
            return client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt
            ).text.strip()
            
        # Hard limit of 5.0 seconds forces the internal `tenacity` retry loop to cancel
        # completely preventing the 48-second UI hang during 429 Quota errors.
        response_text = await asyncio.wait_for(
            asyncio.to_thread(_fetch), timeout=5.0  # type: ignore
        )
        return response_text
    except Exception as e:
        print(f"Gemini API Error: {e}")
        traceback.print_exc()
        return FALLBACK # never breaks the alerts pipeline
