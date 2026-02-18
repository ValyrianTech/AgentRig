# Agent Rig

A standalone 3D avatar visualization tool for AI agents. Display animated 3D avatars controlled via REST API.

## Features

- **3D Avatar Display**: Renders GLTF/GLB models with Three.js
- **Dynamic Model Discovery**: Drop models into `static/models/` - automatically detected
- **API Control**: Trigger animations and emotions via REST endpoints
- **DRACO Support**: Compressed GLTF models supported out of the box
- **Multiple Models**: Switch between models at runtime
- **Idle Animations**: Automatic idle behavior when no commands are active

## Quick Start

```bash
# Create virtual environment and install dependencies
python3 -m venv venv
./venv/bin/pip install -r requirements.txt

# Run the server
./venv/bin/python main.py
```

Open http://localhost:8000 in your browser.

## Adding Models

Just drop `.glb` or `.gltf` files into `static/models/`. They are automatically discovered - no configuration needed.

**Recommended sources for animated models:**
- [Mixamo](https://www.mixamo.com/) - Free characters and animations
- [Ready Player Me](https://readyplayer.me/) - Custom avatars
- [Sketchfab](https://sketchfab.com/) - Large library (filter by "Downloadable" + "Animated")
- [Quaternius](https://quaternius.com/) - Free low-poly characters

**Tips:**
- Models with embedded animations work best
- GLTF/GLB format recommended
- DRACO-compressed models are supported

## API Endpoints

### Models

**List available models:**
```bash
curl http://localhost:8000/api/models
```

**Load a model:**
```bash
curl -X POST http://localhost:8000/api/models/load \
  -H "Content-Type: application/json" \
  -d '{"name": "robot"}'
```

### Animations

**Play an animation:**
```bash
curl -X POST http://localhost:8000/api/animations/play \
  -H "Content-Type: application/json" \
  -d '{"name": "wave", "loop": false}'
```

**Stop animation (return to idle):**
```bash
curl -X POST http://localhost:8000/api/animations/stop
```

### Emotions

**Set emotion:**
```bash
curl -X POST http://localhost:8000/api/emotions/set \
  -H "Content-Type: application/json" \
  -d '{"name": "happy", "intensity": 1.0}'
```

### State

**Get current state:**
```bash
curl http://localhost:8000/api/state
```

## Python Example

```python
import requests

BASE_URL = "http://localhost:8000"

# List available models
models = requests.get(f"{BASE_URL}/api/models").json()
print("Available models:", models["models"])

# Load a model
requests.post(f"{BASE_URL}/api/models/load", json={"name": "robot"})

# Play animation
requests.post(f"{BASE_URL}/api/animations/play", json={"name": "wave"})

# Set emotion
requests.post(f"{BASE_URL}/api/emotions/set", json={"name": "happy"})
```

## Included Models

| Model | Animations |
|-------|------------|
| robot | idle, walking, running, dance, wave, jump, yes, no, punch, thumbsup, death, sitting, standing |
| soldier | idle, walk, run |
| xbot | idle, walk, run, agree, headshake, sad_pose, sneak_pose |

## Project Structure

```
AgentRig/
├── main.py              # FastAPI server
├── requirements.txt     # Python dependencies
├── static/
│   ├── index.html       # Web UI
│   ├── js/
│   │   └── app.js       # Three.js viewer
│   └── models/          # Drop .glb/.gltf files here
└── README.md
```

## Notes

- Animations are model-dependent - use animation names that exist in your model
- The frontend auto-plays idle animation on load
- Camera can be controlled with mouse (orbit controls)
- Models are automatically scaled and centered
