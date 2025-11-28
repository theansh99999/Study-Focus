import torch
from ultralytics import YOLO
import os

def safe_allow_ultralytics():
    try:
        from ultralytics.nn.tasks import DetectionModel
        if hasattr(torch.serialization, 'add_safe_globals'):
            torch.serialization.add_safe_globals([DetectionModel])
        elif hasattr(torch.serialization, 'safe_globals'):
            torch.serialization.safe_globals([DetectionModel])
    except Exception:
        pass

safe_allow_ultralytics()

YOLO_MODEL_PATH = 'yolov8n.pt'
print(f"Loading YOLO model from: {YOLO_MODEL_PATH}")
yolo_model = YOLO(YOLO_MODEL_PATH)
print("YOLO model loaded successfully")

print("\nYOLO Model Labels:")
if hasattr(yolo_model, 'names') and yolo_model.names:
    for i, name in enumerate(yolo_model.names):
        print(f"{i}: {name}")
else:
    print("No names attribute found")

print("\nLooking for phone-related labels:")
phone_keywords = ['phone', 'cell', 'mobile', 'smartphone']
for i, name in enumerate(yolo_model.names):
    if any(keyword in name.lower() for keyword in phone_keywords):
        print(f"{i}: {name}")
