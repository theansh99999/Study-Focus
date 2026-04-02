import cv2
from ultralytics import YOLO

YOLO_MODEL_PATH = "yolov8s.pt"
yolo_model = YOLO(YOLO_MODEL_PATH)

import numpy as np
frame = np.zeros((480, 640, 3), dtype=np.uint8)

try:
    results = yolo_model.predict(frame, imgsz=640, conf=0.05, verbose=False)
    for res in results:
        boxes = res.boxes
        if boxes is None:
            continue
        for box in boxes:
            cls_id = int(box.cls[0])
            conf = float(box.conf[0])
            label = yolo_model.names.get(cls_id, str(cls_id))
            print("Detected", label, conf)
    print("Success")
except Exception as e:
    import traceback
    traceback.print_exc()
