from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
from pathlib import Path
import uvicorn

app = FastAPI(title="Agent Rig", description="3D Avatar Visualization Tool for AI Agents")

MODELS_DIR = Path("static/models")


def get_available_models():
    """Scan models directory for .glb and .gltf files"""
    if not MODELS_DIR.exists():
        return []
    glb_files = [f.stem for f in MODELS_DIR.glob("*.glb")]
    gltf_files = [f.stem for f in MODELS_DIR.glob("*.gltf")]
    return list(set(glb_files + gltf_files))


# Current avatar state
avatar_state = {
    "current_model": "robot",
    "current_animation": "idle",
    "current_emotion": "neutral",
    "animation_queue": []
}


class AnimationRequest(BaseModel):
    name: str
    loop: bool = False
    duration: Optional[float] = None  # Override duration in seconds


class EmotionRequest(BaseModel):
    name: str
    intensity: float = 1.0  # 0.0 to 1.0


class ModelRequest(BaseModel):
    name: str


@app.get("/")
async def root():
    return FileResponse("static/index.html")


@app.get("/api/state")
async def get_state():
    """Get current avatar state"""
    return avatar_state


@app.get("/api/animations")
async def list_animations():
    """List animations - note: actual available animations depend on the loaded model"""
    return {
        "message": "Animations are model-dependent. The frontend will play any animation that exists in the current model.",
        "current_model": avatar_state["current_model"]
    }


@app.post("/api/animations/play")
async def play_animation(request: AnimationRequest):
    """Trigger an animation on the avatar. Any animation name is accepted - frontend will handle if it doesn't exist."""
    avatar_state["current_animation"] = request.name
    avatar_state["animation_queue"].append({
        "name": request.name,
        "loop": request.loop,
        "duration": request.duration
    })
    
    return {
        "status": "ok",
        "message": f"Playing animation: {request.name}",
        "animation": request.name
    }


@app.post("/api/animations/stop")
async def stop_animation():
    """Stop current animation and return to idle"""
    avatar_state["current_animation"] = "idle"
    avatar_state["animation_queue"] = []
    return {"status": "ok", "message": "Returned to idle"}


@app.get("/api/emotions")
async def list_emotions():
    """List emotions - note: actual available emotions depend on the loaded model's morph targets"""
    return {
        "message": "Emotions are model-dependent (morph targets). The frontend will apply any emotion that exists in the current model.",
        "current_model": avatar_state["current_model"]
    }


@app.post("/api/emotions/set")
async def set_emotion(request: EmotionRequest):
    """Set the avatar's emotional expression. Any emotion name is accepted - frontend will handle if it doesn't exist."""
    avatar_state["current_emotion"] = request.name
    
    return {
        "status": "ok",
        "message": f"Emotion set to: {request.name}",
        "emotion": request.name,
        "intensity": request.intensity
    }


@app.get("/api/queue")
async def get_queue():
    """Get the current animation queue"""
    return {"queue": avatar_state["animation_queue"]}


@app.delete("/api/queue")
async def clear_queue():
    """Clear the animation queue"""
    avatar_state["animation_queue"] = []
    return {"status": "ok", "message": "Queue cleared"}


@app.get("/api/models")
async def list_models():
    """List all available models by scanning the models directory"""
    models = get_available_models()
    return {"models": models, "current": avatar_state["current_model"]}


@app.post("/api/models/load")
async def load_model(request: ModelRequest):
    """Load a different 3D model"""
    available = get_available_models()
    if request.name not in available:
        return {
            "status": "error",
            "message": f"Model '{request.name}' not found. Available: {available}"
        }
    
    avatar_state["current_model"] = request.name
    avatar_state["current_animation"] = "idle"
    
    return {
        "status": "ok",
        "message": f"Model changed to: {request.name}",
        "model": request.name
    }


# Mount static files (must be after API routes)
app.mount("/static", StaticFiles(directory="static"), name="static")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
