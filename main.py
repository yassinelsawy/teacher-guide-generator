"""Application entrypoint that re-exports FastAPI app from src package."""

from src.app import app


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
