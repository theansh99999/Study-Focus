# app.py (Full-featured: YOLO phone detection + MediaPipe EAR eye-closure + Flask dashboard/export)
from flask import Flask, render_template, request, jsonify, send_file
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
import threading
import time
import cv2
import numpy as np
import mediapipe as mp
import pandas as pd
from io import BytesIO
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from ultralytics import YOLO
import os

# ----------------- Flask + DB setup -----------------
app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///focus_monitor.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.secret_key = 'change-this-secret'
db = SQLAlchemy(app)

# ----------------- Database models -----------------
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    daily_goal_minutes = db.Column(db.Integer, default=120)
    eye_closure_threshold = db.Column(db.Float, default=3.0)  # seconds
    sessions = db.relationship('Session', backref='user', lazy=True)
    events = db.relationship('Event', backref='user', lazy=True)

class Session(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    start_time = db.Column(db.DateTime, default=datetime.utcnow)
    end_time = db.Column(db.DateTime)
    total_duration = db.Column(db.Integer, default=0)  # seconds
    focus_duration = db.Column(db.Integer, default=0)  # seconds
    distraction_duration = db.Column(db.Integer, default=0)  # seconds
    is_active = db.Column(db.Boolean, default=True)

class Event(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    session_id = db.Column(db.Integer, db.ForeignKey('session.id'), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    event_type = db.Column(db.String(50), nullable=False)  # 'eye_closed','phone_detected', etc.
    duration = db.Column(db.Float, default=0.0)  # seconds

with app.app_context():
    db.create_all()

# ----------------- Detection models setup -----------------
# YOLO model (lightweight). Replace with your custom path if needed.
YOLO_MODEL_PATH = os.getenv('YOLO_MODEL_PATH', 'yolov8n.pt')
yolo_model = YOLO(YOLO_MODEL_PATH)

# Mediapipe FaceMesh for EAR
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(
    max_num_faces=4,
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

# ----------------- Global monitoring state -----------------
monitoring_active = False
current_user = None
camera = None
monitoring_thread = None
camera_lock = threading.Lock()

# Phone detection persistence config
PHONE_CONF_THRESHOLD = 0.65   # YOLO confidence threshold
MIN_PHONE_FRAMES = 4         # consecutive frames required to confirm phone
MIN_PHONE_AREA = 1500        # minimum bbox area to consider (tune to camera/resolution)
PHONE_ALERT_COOLDOWN = 5.0   # seconds between phone event logs

# EAR / eye-closure config
BASELINE_FRAMES = 50
EAR_SMOOTH_WINDOW = 8
EAR_DYNAMIC_MULTIPLIER = 0.7
EYE_ALERT_COOLDOWN = 5.0

# ----------------- Helper functions -----------------
def calculate_ear(landmarks, frame_shape):
    """Return average EAR (left+right)/2 from mediapipe landmarks list"""
    h, w = frame_shape[:2]
    # MediaPipe indexes for eyes
    LEFT_EYE = [33, 160, 158, 133, 153, 144]
    RIGHT_EYE = [362, 385, 387, 263, 373, 380]

    def to_pixel(idx):
        lm = landmarks[idx]
        return np.array([lm.x * w, lm.y * h])

    def eye_aspect_ratio(idxs):
        p1 = to_pixel(idxs[0])
        p2 = to_pixel(idxs[1])
        p3 = to_pixel(idxs[2])
        p4 = to_pixel(idxs[3])
        p5 = to_pixel(idxs[4])
        p6 = to_pixel(idxs[5])
        A = np.linalg.norm(p2 - p6)
        B = np.linalg.norm(p3 - p5)
        C = np.linalg.norm(p1 - p4)
        if C == 0:
            return 0.0
        return (A + B) / (2.0 * C)

    leftEAR = eye_aspect_ratio(LEFT_EYE)
    rightEAR = eye_aspect_ratio(RIGHT_EYE)
    return (leftEAR + rightEAR) / 2.0

def detect_phone_with_yolo(frame):
    """
    Use YOLO to detect phones. Returns (True/False, bbox) where bbox=(x,y,w,h)
    Implement confidence threshold, area threshold and return first matching bbox.
    """
    # ultralytics supports both predict and direct call; here we use predict-like API
    # run inference (single image). Use larger imgsz for accuracy if you can.
    results = yolo_model.predict(frame, imgsz=640, conf=PHONE_CONF_THRESHOLD, verbose=False)

    for res in results:
        # each res.boxes contains detected boxes
        boxes = res.boxes
        if boxes is None:
            continue
        for box in boxes:
            cls_id = int(box.cls[0])
            conf = float(box.conf[0])
            # In COCO, 'cell phone' class id is usually 67; but use model.names for safety
            label = yolo_model.names.get(cls_id, str(cls_id))
            if label.lower() in ['cell phone', 'cellphone', 'mobile phone', 'phone', 'cellphone']:
                xyxy = box.xyxy[0].cpu().numpy().astype(int)
                x1, y1, x2, y2 = xyxy
                w = x2 - x1
                h = y2 - y1
                area = w * h
                # filter small boxes and require min confidence (already set by conf arg)
                if area >= MIN_PHONE_AREA and conf >= PHONE_CONF_THRESHOLD:
                    return True, (x1, y1, w, h), conf
    return False, None, 0.0

# ----------------- Monitoring thread -----------------
def monitor_user():
    """
    Long-running thread: reads camera frames, runs MEDIAPIPE for EAR and YOLO for phone,
    logs events to DB, and updates session durations when monitoring stops.
    """
    global monitoring_active, current_user, camera

    with app.app_context():
        # session management
        session = Session.query.filter_by(user_id=current_user.id, is_active=True).first()
        if not session:
            session = Session(user_id=current_user.id)
            db.session.add(session)
            db.session.commit()

        # EAR baseline and smoothing
        baseline_vals = []
        frame_count = 0
        baseline_ear = None
        ear_history = []

        # Eye detection timers
        eye_closed_start = None
        last_eye_alert_time = 0

        # Phone detection persistence
        phone_detected_frames = 0
        phone_event_start = None
        last_phone_alert_time = 0

        while monitoring_active and camera is not None:
            with camera_lock:
                ret, frame = camera.read()
            if not ret or frame is None:
                time.sleep(0.05)
                continue

            frame = cv2.flip(frame, 1)
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            current_time = time.time()

            # ----- Face/Eye detection (MediaPipe) -----
            try:
                results = face_mesh.process(rgb_frame)
            except Exception as e:
                results = None

            smooth_ear = None
            if results and results.multi_face_landmarks:
                # Choose the largest face to be primary (approx via bounding box from landmarks)
                chosen_landmarks = None
                max_area = 0
                for face_landmarks in results.multi_face_landmarks:
                    # compute bbox from landmarks
                    xs = [lm.x for lm in face_landmarks.landmark]
                    ys = [lm.y for lm in face_landmarks.landmark]
                    min_x, max_x = min(xs), max(xs)
                    min_y, max_y = min(ys), max(ys)
                    area = (max_x - min_x) * (max_y - min_y)
                    if area > max_area:
                        max_area = area
                        chosen_landmarks = face_landmarks

                if chosen_landmarks is not None:
                    ear = calculate_ear(chosen_landmarks.landmark, frame.shape)
                    # collect baseline for first N frames
                    if frame_count < BASELINE_FRAMES:
                        if ear > 0:
                            baseline_vals.append(ear)
                        frame_count += 1
                        if frame_count == BASELINE_FRAMES:
                            if baseline_vals:
                                baseline_ear = float(np.median(baseline_vals))
                            else:
                                baseline_ear = 0.25  # fallback
                            # debug print
                            print(f"[Baseline EAR] set to {baseline_ear:.3f}")
                    # smoothing
                    ear_history.append(ear)
                    if len(ear_history) > EAR_SMOOTH_WINDOW:
                        ear_history.pop(0)
                    smooth_ear = float(np.mean(ear_history))
                    # dynamic threshold
                    if baseline_ear:
                        dynamic_threshold = baseline_ear * EAR_DYNAMIC_MULTIPLIER
                    else:
                        dynamic_threshold = 0.22
                    # detect closure
                    if smooth_ear < dynamic_threshold and smooth_ear > 0:
                        if eye_closed_start is None:
                            eye_closed_start = current_time
                        elif (current_time - eye_closed_start) >= current_user.eye_closure_threshold:
                            # cooldown check
                            if current_time - last_eye_alert_time >= EYE_ALERT_COOLDOWN:
                                duration = current_time - eye_closed_start
                                ev = Event(user_id=current_user.id, session_id=session.id,
                                           event_type='eye_closed', duration=duration)
                                db.session.add(ev)
                                db.session.commit()
                                last_eye_alert_time = current_time
                                print(f"[ALERT] eye_closed logged: {duration:.2f}s")
                    else:
                        eye_closed_start = None

            # ----- Phone detection (YOLO) -----
            phone_detected, phone_rect, phone_conf = detect_phone_with_yolo(frame)
            if phone_detected:
                phone_detected_frames += 1
            else:
                phone_detected_frames = 0
                phone_event_start = None

            if phone_detected_frames >= MIN_PHONE_FRAMES:
                if phone_event_start is None:
                    phone_event_start = current_time
                # cooldown check
                if (current_time - last_phone_alert_time) >= PHONE_ALERT_COOLDOWN:
                    duration = current_time - phone_event_start
                    ev = Event(user_id=current_user.id, session_id=session.id,
                               event_type='phone_detected', duration=duration)
                    db.session.add(ev)
                    db.session.commit()
                    last_phone_alert_time = current_time
                    phone_event_start = current_time
                    print(f"[ALERT] phone_detected logged: {duration:.2f}s (conf {phone_conf:.2f})")

            # optional: draw bounding boxes for debugging (not necessary here)
            # time-sleep to reduce CPU usage
            time.sleep(0.07)

        # when monitoring stops: update session end and durations
        session = Session.query.filter_by(id=session.id).first()
        if session and session.is_active:
            session.end_time = datetime.utcnow()
            session.is_active = False
            total_duration = (session.end_time - session.start_time).total_seconds()
            session.total_duration = int(total_duration)
            events = Event.query.filter_by(session_id=session.id).all()
            distraction_duration = sum(e.duration for e in events)
            session.distraction_duration = int(distraction_duration)
            session.focus_duration = max(0, session.total_duration - session.distraction_duration)
            db.session.commit()

# ----------------- Routes (API) -----------------
@app.route('/')
def index():
    return render_template('index.html')  # create front-end accordingly

@app.route('/api/users', methods=['GET'])
def get_users():
    users = User.query.all()
    return jsonify([{'id': u.id, 'username': u.username} for u in users])

@app.route('/api/login', methods=['POST'])
def login():
    global current_user
    data = request.json
    username = data.get('username')
    if not username:
        return jsonify({'error': 'Username required'}), 400
    user = User.query.filter_by(username=username).first()
    if not user:
        user = User(username=username)
        db.session.add(user)
        db.session.commit()
    current_user = user
    return jsonify({'success': True, 'user': {'id': user.id, 'username': user.username}})

@app.route('/api/start_monitoring', methods=['POST'])
def start_monitoring():
    global monitoring_active, camera, monitoring_thread, current_user
    if not current_user:
        return jsonify({'error': 'No user logged in'}), 400
    if monitoring_active:
        return jsonify({'error': 'Monitoring already active'}), 400
    try:
        # init camera
        cam = cv2.VideoCapture(0)
        if not cam.isOpened():
            return jsonify({'error': 'Cannot access camera'}), 500
        camera = cam
        monitoring_active = True
        monitoring_thread = threading.Thread(target=monitor_user, daemon=True)
        monitoring_thread.start()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stop_monitoring', methods=['POST'])
def stop_monitoring():
    global monitoring_active, camera
    monitoring_active = False
    # release camera safely
    with camera_lock:
        if camera:
            camera.release()
            camera = None
    # session end handled inside monitor_user when thread exits
    return jsonify({'success': True})

@app.route('/api/dashboard_data')
def dashboard_data():
    if not current_user:
        return jsonify({'error': 'No user logged in'}), 400
    today = datetime.now().date()
    today_start = datetime.combine(today, datetime.min.time())
    today_end = datetime.combine(today, datetime.max.time())

    # sessions and events for today
    sessions = Session.query.filter(
        Session.user_id == current_user.id,
        Session.start_time >= today_start,
        Session.start_time <= today_end
    ).all()
    events = Event.query.filter(
        Event.user_id == current_user.id,
        Event.timestamp >= today_start,
        Event.timestamp <= today_end
    ).order_by(Event.timestamp.desc()).limit(10).all()

    total_focus_time = sum(s.focus_duration for s in sessions)
    total_distraction_time = sum(s.distraction_duration for s in sessions)
    eye_closed_events = len([e for e in events if e.event_type == 'eye_closed'])
    phone_detected_events = len([e for e in events if e.event_type == 'phone_detected'])
    goal_progress = min(100, (total_focus_time / 60) / (current_user.daily_goal_minutes + 1e-9) * 100)

    return jsonify({
        'total_focus_time': total_focus_time,
        'total_distraction_time': total_distraction_time,
        'goal_progress': goal_progress,
        'daily_goal': current_user.daily_goal_minutes,
        'recent_events': [{
            'timestamp': e.timestamp.isoformat(),
            'type': e.event_type,
            'duration': e.duration
        } for e in events],
        'event_breakdown': {
            'eye_closed': eye_closed_events,
            'phone_detected': phone_detected_events
        },
        'monitoring_active': monitoring_active
    })

@app.route('/api/settings', methods=['GET', 'POST'])
def settings():
    if not current_user:
        return jsonify({'error': 'No user logged in'}), 400
    if request.method == 'POST':
        data = request.json
        if 'daily_goal_minutes' in data:
            current_user.daily_goal_minutes = int(data['daily_goal_minutes'])
        if 'eye_closure_threshold' in data:
            current_user.eye_closure_threshold = float(data['eye_closure_threshold'])
        db.session.commit()
        return jsonify({'success': True})
    return jsonify({
        'daily_goal_minutes': current_user.daily_goal_minutes,
        'eye_closure_threshold': current_user.eye_closure_threshold
    })

@app.route('/api/reset_user_data', methods=['POST'])
def reset_user_data():
    if not current_user:
        return jsonify({'error': 'No user logged in'}), 400
    Event.query.filter_by(user_id=current_user.id).delete()
    Session.query.filter_by(user_id=current_user.id).delete()
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/export_data/<string:format>')
def export_data(format):
    if not current_user:
        return jsonify({'error': 'No user logged in'}), 400
    sessions = Session.query.filter_by(user_id=current_user.id).all()
    events = Event.query.filter_by(user_id=current_user.id).all()

    if format == 'csv':
        session_rows = []
        for s in sessions:
            session_rows.append({
                'Date': s.start_time.strftime('%Y-%m-%d'),
                'Start Time': s.start_time.strftime('%H:%M:%S'),
                'End Time': s.end_time.strftime('%H:%M:%S') if s.end_time else 'Active',
                'Total Duration (min)': s.total_duration / 60,
                'Focus Duration (min)': s.focus_duration / 60,
                'Distraction Duration (min)': s.distraction_duration / 60
            })
        df = pd.DataFrame(session_rows)
        out = BytesIO()
        df.to_csv(out, index=False)
        out.seek(0)
        return send_file(out, mimetype='text/csv', as_attachment=True,
                         download_name=f'{current_user.username}_focus_data.csv')

    elif format == 'pdf':
        out = BytesIO()
        c = canvas.Canvas(out, pagesize=letter)
        c.setFont("Helvetica-Bold", 16)
        c.drawString(50, 750, f"Focus Monitor Report - {current_user.username}")
        y = 720
        c.setFont("Helvetica", 12)
        total_sessions = len(sessions)
        total_focus_minutes = sum(s.focus_duration for s in sessions) / 60
        total_distraction_minutes = sum(s.distraction_duration for s in sessions) / 60
        c.drawString(50, y, f"Total Sessions: {total_sessions}"); y -= 20
        c.drawString(50, y, f"Total Focus Time: {total_focus_minutes:.1f} minutes"); y -= 20
        c.drawString(50, y, f"Total Distraction Time: {total_distraction_minutes:.1f} minutes"); y -= 30
        c.setFont("Helvetica-Bold", 14); c.drawString(50, y, "Session Details"); y -= 20
        c.setFont("Helvetica", 10)
        for s in sessions:
            c.drawString(50, y, f"{s.start_time} - total: {s.total_duration/60:.1f} min, focus: {s.focus_duration/60:.1f} min"); y -= 14
            if y < 60:
                c.showPage(); y = 750
        c.save()
        out.seek(0)
        return send_file(out, mimetype='application/pdf', as_attachment=True,
                         download_name=f'{current_user.username}_focus_report.pdf')

    else:
        return jsonify({'error': 'Invalid format'}), 400

@app.route('/api/comparison_data')
def comparison_data():
    users = User.query.all()
    comparison = []
    for u in users:
        sessions = Session.query.filter_by(user_id=u.id).all()
        total_focus = sum(s.focus_duration for s in sessions) / 60
        total_distraction = sum(s.distraction_duration for s in sessions) / 60
        total = total_focus + total_distraction
        focus_percentage = (total_focus / total) * 100 if total > 0 else 0
        comparison.append({
            'username': u.username,
            'focus_time': total_focus,
            'distraction_time': total_distraction,
            'focus_percentage': focus_percentage
        })
    # sort by focus_percentage desc
    comparison = sorted(comparison, key=lambda x: x['focus_percentage'], reverse=True)
    return jsonify(comparison)

# ----------------- Clean app exit -----------------
def cleanup_on_exit():
    global camera
    with camera_lock:
        if camera:
            camera.release()
            camera = None

import atexit
atexit.register(cleanup_on_exit)

# ----------------- Run app -----------------
if __name__ == '__main__':
    # Ensure model is loaded at start to avoid runtime lag
    print("[Startup] Loaded YOLO model:", YOLO_MODEL_PATH)
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)
