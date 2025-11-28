import cv2
import numpy as np
from ultralytics import YOLO
import torch
import os

def safe_allow_ultralytics():
    """Allowlist ultralytics DetectionModel for torch.load when weights_only restrictions exist."""
    try:
        from ultralytics.nn.tasks import DetectionModel
        if hasattr(torch.serialization, 'add_safe_globals'):
            torch.serialization.add_safe_globals([DetectionModel])
        elif hasattr(torch.serialization, 'safe_globals'):
            torch.serialization.safe_globals([DetectionModel])
    except Exception:
        pass

safe_allow_ultralytics()

# Load YOLO model
YOLO_MODEL_PATH = 'yolov8n.pt'
print(f"Loading YOLO model from: {YOLO_MODEL_PATH}")
try:
    yolo_model = YOLO(YOLO_MODEL_PATH)
    print("YOLO model loaded successfully")
    print(f"Model names: {yolo_model.names}")
except Exception as e:
    print(f"Failed to load model: {e}")
    exit()

# Test with camera
cap = cv2.VideoCapture(0)
if not cap.isOpened():
    print("Cannot open camera")
    exit()

print("Testing phone detection. Press 'q' to quit.")

frame_count = 0
while True:
    ret, frame = cap.read()
    if not ret:
        break

    frame_count += 1
    print(f"Frame {frame_count}: Processing...")

    try:
        with torch.no_grad():
            preds = yolo_model.predict(frame, imgsz=640, conf=0.05, verbose=False)
    except Exception as e:
        print(f"Prediction error: {e}")
        continue

    if not preds:
        print("No predictions")
        continue

    results_iter = preds
    if hasattr(preds, 'boxes') and not isinstance(preds, (list, tuple)):
        results_iter = [preds]

    for res in results_iter:
        boxes = getattr(res, 'boxes', None)
        if boxes is None:
            continue

        for box in boxes:
            try:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                label = yolo_model.names.get(cls_id, str(cls_id)) if getattr(yolo_model, 'names', None) else str(cls_id)

                print(f"Detected: {label} (conf: {conf:.3f})")

                # Check for phone-related labels (partial matching)
                phone_labels = ['cell phone', 'cellphone', 'mobile phone', 'phone', 'smartphone']
                is_phone = any(phone_label in label.lower() for phone_label in phone_labels)
                print(f"Is phone? {is_phone} (checking against: {phone_labels})")
                if is_phone:
                    xyxy = None
                    if hasattr(box, 'xyxy'):
                        xyxy = box.xyxy[0].cpu().numpy().astype(int)
                    elif hasattr(box, 'xyxyn'):
                        xyxy = (box.xyxyn[0].cpu().numpy() * np.array([frame.shape[1], frame.shape[0], frame.shape[1], frame.shape[0]])).astype(int)

                    if xyxy is not None:
                        x1, y1, x2, y2 = xyxy[:4]
                        w = x2 - x1
                        h = y2 - y1
                        area = w * h
                        if area >= 100:
                            print(f"Phone detected: {label}, area: {area}, conf: {conf}")
                            x, y, w, h = x1, y1, w, h
                            cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 0), 2)
                            cv2.putText(frame, f"Phone {conf:.2f}", (x, y-10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2)
            except Exception as e:
                print(f"Box processing error: {e}")
                continue

    cv2.imshow('Phone Detection Test', frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
