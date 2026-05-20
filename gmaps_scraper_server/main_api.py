from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from typing import Optional, List, Dict, Any
import logging
import asyncio
from gmaps_scraper_server.history_db import init_db, save_search, get_history, delete_history_item, clear_all_history

# Import the scraper function (adjust path if necessary)
try:
    from gmaps_scraper_server.scraper import scrape_google_maps
except ImportError:
    # Handle case where scraper might be in a different structure later
    logging.error("Could not import scrape_google_maps from scraper.py")
    # Define a dummy function to allow API to start, but fail on call
    def scrape_google_maps(*args, **kwargs):
        raise ImportError("Scraper function not available.")

# Configure basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = FastAPI(
    title="Google Maps Scraper API",
    description="API to trigger Google Maps scraping based on a query.",
    version="0.1.0",
)

@app.on_event("startup")
def startup_event():
    logging.info("Initializing search history database...")
    init_db()

# Mount the static files directory to serve HTML/CSS/JS
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.post("/scrape", response_model=List[Dict[str, Any]])
async def run_scrape(
    query: str = Query(..., description="The search query for Google Maps (e.g., 'restaurants in New York')"),
    max_places: Optional[int] = Query(None, description="Maximum number of places to scrape. Scrapes all found if None."),
    lang: str = Query("en", description="Language code for Google Maps results (e.g., 'en', 'es')."),
    headless: bool = Query(True, description="Run the browser in headless mode (no UI). Set to false for debugging locally."),
    concurrency: int = Query(5, description="Number of concurrent tabs for scraping details. Default is 5.")
):
    """
    Triggers the Google Maps scraping process for the given query.
    """
    logging.info(f"Received scrape request for query: '{query}', max_places: {max_places}, lang: {lang}, "
                 f"headless: {headless}, concurrency: {concurrency}")
    try:
        # Run the potentially long-running scraping task with timeout
        # Note: For production, consider running this in a background task queue (e.g., Celery)
        # to avoid blocking the API server for long durations.
        results = await asyncio.wait_for(
            scrape_google_maps(
                query=query,
                max_places=max_places,
                lang=lang,
                headless=headless,
                concurrency=concurrency
            ),
            timeout=300  # 5 minutes timeout
        )
        logging.info(f"Scraping finished for query: '{query}'. Found {len(results)} results.")
        save_search(
            query=query,
            max_places=max_places,
            lang=lang,
            concurrency=concurrency,
            headless=headless,
            results_count=len(results)
        )
        return results
    except asyncio.TimeoutError:
        logging.error(f"Scraping timeout for query '{query}' after 300 seconds")
        raise HTTPException(status_code=504, detail="Scraping request timed out after 5 minutes")
    except ImportError as e:
         logging.error(f"ImportError during scraping for query '{query}': {e}")
         raise HTTPException(status_code=500, detail="Server configuration error: Scraper not available.")
    except Exception as e:
        logging.error(f"An error occurred during scraping for query '{query}': {e}", exc_info=True)
        # Consider more specific error handling based on scraper exceptions
        raise HTTPException(status_code=500, detail=f"An internal error occurred during scraping: {str(e)}")

@app.get("/scrape-get", response_model=List[Dict[str, Any]])
async def run_scrape_get(
    query: str = Query(..., description="The search query for Google Maps (e.g., 'restaurants in New York')"),
    max_places: Optional[int] = Query(None, description="Maximum number of places to scrape. Scrapes all found if None."),
    lang: str = Query("en", description="Language code for Google Maps results (e.g., 'en', 'es')."),
    headless: bool = Query(True, description="Run the browser in headless mode (no UI). Set to false for debugging locally."),
    concurrency: int = Query(5, description="Number of concurrent tabs for scraping details. Default is 5.")
):
    """
    Triggers the Google Maps scraping process for the given query via GET request.
    """
    logging.info(f"Received GET scrape request for query: '{query}', max_places: {max_places}, lang: {lang}, "
                 f"headless: {headless}, concurrency: {concurrency}")
    try:
        # Run the potentially long-running scraping task with timeout
        # Note: For production, consider running this in a background task queue (e.g., Celery)
        # to avoid blocking the API server for long durations.
        results = await asyncio.wait_for(
            scrape_google_maps(
                query=query,
                max_places=max_places,
                lang=lang,
                headless=headless,
                concurrency=concurrency
            ),
            timeout=300  # 5 minutes timeout
        )
        logging.info(f"Scraping finished for query: '{query}'. Found {len(results)} results.")
        save_search(
            query=query,
            max_places=max_places,
            lang=lang,
            concurrency=concurrency,
            headless=headless,
            results_count=len(results)
        )
        return results
    except asyncio.TimeoutError:
        logging.error(f"Scraping timeout for query '{query}' after 300 seconds")
        raise HTTPException(status_code=504, detail="Scraping request timed out after 5 minutes")
    except ImportError as e:
         logging.error(f"ImportError during scraping for query '{query}': {e}")
         raise HTTPException(status_code=500, detail="Server configuration error: Scraper not available.")
    except Exception as e:
        logging.error(f"An error occurred during scraping for query '{query}': {e}", exc_info=True)
        # Consider more specific error handling based on scraper exceptions
        raise HTTPException(status_code=500, detail=f"An internal error occurred during scraping: {str(e)}")

@app.get("/history", response_model=List[Dict[str, Any]])
async def fetch_history(limit: int = Query(10, description="Number of history items to return.")):
    return get_history(limit)

@app.delete("/history/{item_id}")
async def delete_history(item_id: int):
    delete_history_item(item_id)
    return {"status": "success"}

@app.delete("/history")
async def clear_history():
    clear_all_history()
    return {"status": "success"}

# Serve the Web User Interface at the root endpoint
@app.get("/")
async def read_root():
    return FileResponse("static/index.html")

# Example for running locally (uvicorn main_api:app --reload)
# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run(app, host="0.0.0.0", port=8001)