from fastapi import FastAPI

app = FastAPI(
    title="Analytics Service",
    description="Analytics service for team collaboration platform",
    version="0.1.0",
    docs_url="/analytics/docs",
    openapi_url="/analytics/openapi.json",
)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "analytics"}
