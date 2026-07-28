from fastapi import FastAPI

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "Hello World"}

@app.get("/health")
async def health():
    return {
        "messge":"This route is health",
        "status":"ok",
        "status-code":200
    }