# 🎯 Study-Focus — AI-Powered Focus & Productivity Monitor
![Python](https://img.shields.io/badge/Python-3.10-blue)
![Flask](https://img.shields.io/badge/Flask-2.3-green)
![Docker](https://img.shields.io/badge/Docker-Enabled-blue)
> A **real-time computer vision** application that watches your study habits so you can build better ones. Detects drowsiness, phone usage, posture problems, gaze direction, and more — all through your webcam.

<br/>

## 🧠 What Is This?

**Study-Focus** is a Flask-based web application that uses your webcam and a combination of **YOLOv8**, **MediaPipe FaceMesh**, and **MediaPipe Pose** to monitor you while you study. It logs distraction events, tracks your focus sessions, generates analytics, and exports reports — all from your browser.

This project is **locally run** — no cloud, no signup, no data leaves your machine.

---

## ✨ Features

### 👁️ Real-Time Distraction Detection

| Detection Type | Technology | How It Works |
|---|---|---|
| **Eye Closure / Drowsiness** | MediaPipe FaceMesh + EAR | Calculates Eye Aspect Ratio (EAR); alerts if eyes closed > threshold (default 3s) |
| **Phone Detection** | YOLOv8 (COCO) | Detects `cell phone` class; requires ≥4 consecutive frames + min bbox area to reduce false positives |
| **Multiple People** | YOLOv8 (COCO) | Detects `person` class count > 1; useful for exam/study room monitoring |
| **Gaze / Looking Away** | MediaPipe FaceMesh Iris | Tracks iris position ratio within eye socket; warns immediately, logs distraction after 10s |
| **Posture Detection** | MediaPipe Pose | Classifies posture as `straight`, `leaning`, or `slouching` using shoulder tilt + nose-shoulder ratio |

### 📊 Analytics Dashboard

- **Real-time stats**: Focus time, distraction time, and goal progress (refreshes every 5 seconds)
- **Interactive Charts** (Chart.js):
  - Focus vs Distraction doughnut chart
  - Event breakdown by type (eye_closed, phone_detected, multiple_people, looking_away, posture_bad)
  - User comparison leaderboard (bar chart)
- **Recent Events Table**: Last 10 events with type, timestamp, and duration
- **Daily Goal Progress**: Customizable target (default: 120 mins) with visual progress bar

### 📹 Live Video Feed

- Real-time annotated webcam stream at `/video_feed`
- Bounding boxes drawn on detected phones and people
- On-frame text labels for eye closure, gaze direction, and posture state
- Camera feed is mirrored (flipped horizontally) for natural display

### 🔐 User Management

- **Username-based login** — no password required
- Auto-creates new user profile if username doesn't exist
- Per-user settings: daily goal & eye closure threshold
- Data reset option to clear all sessions and events

### ⚙️ Detection Tuning (Configurable in `app.py`)

| Parameter | Default | Description |
|---|---|---|
| `PHONE_CONF_THRESHOLD` | `0.65` | Minimum YOLO confidence to count as phone |
| `MIN_PHONE_FRAMES` | `4` | Consecutive frames needed to confirm phone |
| `MIN_PHONE_AREA` | `1500` | Minimum bounding box area (pixels²) |
| `EAR_DYNAMIC_MULTIPLIER` | `0.7` | Fraction of baseline EAR below which eyes = closed |
| `BASELINE_FRAMES` | `50` | Frames used to calibrate personal EAR baseline |
| `GAZE_DISTRACTION_THRESHOLD` | `10.0s` | Seconds looking away before logging as distraction |
| `POSTURE_SLOUCH_PERSIST` | `5.0s` | Seconds of slouching before logging as event |

### 📤 Data Export

- **CSV** — Session-level data (focus time, distraction time per session)
- **PDF** — Summary report with session details via ReportLab

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python 3.10, Flask 2.3 |
| **Database** | SQLite (via Flask-SQLAlchemy) |
| **Computer Vision** | OpenCV, MediaPipe (FaceMesh + Pose), Ultralytics YOLOv8 |
| **Frontend** | HTML5, CSS3 (custom), Vanilla JavaScript |
| **Charts** | Chart.js |
| **ML Models** | `yolov8n.pt` (default), `yolov8s.pt` (optional, more accurate) |
| **Export** | Pandas (CSV), ReportLab (PDF) |
| **Containerization** | Docker + Docker Compose |

---

## 📁 Project Structure

```
Study-Focus/
├── app.py                  # Main Flask app — all routes, detection logic, DB models
├── requirements.txt        # Python dependencies
├── Dockerfile              # Docker image definition (python:3.10-slim)
├── docker-compose.yml      # Local Docker Compose setup
├── yolov8n.pt              # YOLOv8 nano model (default, faster)
├── yolov8s.pt              # YOLOv8 small model (optional, more accurate)
├── test_yolo.py            # Quick YOLO model test script
├── future_plan.txt         # Feature roadmap & ideas
├── instance/
│   └── focus_monitor.db    # SQLite database (auto-created on first run)
├── templates/
│   └── index.html          # Main dashboard (single-page app)
└── static/
    ├── css/
    │   └── style.css       # Custom styles & dark/light theme
    └── js/
        └── app.js          # Frontend logic (API calls, charts, alerts)
```

---

## 🗄️ Database Schema

### `user` Table
| Column | Type | Description |
|---|---|---|
| `id` | Integer (PK) | Auto-increment |
| `username` | String(80) | Unique username |
| `created_at` | DateTime | Account creation time |
| `daily_goal_minutes` | Integer | Personal focus goal (default: 120) |
| `eye_closure_threshold` | Float | Seconds before eye-close alert (default: 3.0) |

### `session` Table
| Column | Type | Description |
|---|---|---|
| `id` | Integer (PK) | Auto-increment |
| `user_id` | FK → user | Owner of session |
| `start_time` / `end_time` | DateTime | Session window |
| `total_duration` | Integer | Seconds |
| `focus_duration` | Integer | Seconds (total − distraction) |
| `distraction_duration` | Integer | Sum of all event durations in seconds |
| `is_active` | Boolean | True while monitoring is running |

### `event` Table
| Column | Type | Description |
|---|---|---|
| `id` | Integer (PK) | Auto-increment |
| `user_id` | FK → user | Owner |
| `session_id` | FK → session | Parent session |
| `timestamp` | DateTime | When event occurred |
| `event_type` | String(50) | `eye_closed` / `phone_detected` / `multiple_people` / `looking_away` / `posture_bad` |
| `duration` | Float | Duration in seconds |

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Render main dashboard |
| `GET` | `/video_feed` | MJPEG live annotated camera stream |
| `GET` | `/api/status` | Current alert state (JSON) |
| `GET` | `/api/users` | List all users |
| `POST` | `/api/login` | Login / auto-create user |
| `POST` | `/api/logout` | Logout and stop monitoring |
| `POST` | `/api/start_monitoring` | Start webcam + detection thread |
| `POST` | `/api/stop_monitoring` | Stop monitoring and save session |
| `GET` | `/api/dashboard_data` | Today's stats, events, goal progress |
| `GET/POST` | `/api/settings` | Get or update user settings |
| `POST` | `/api/reset_user_data` | Delete all user sessions + events |
| `GET` | `/api/export_data/<format>` | Export as `csv` or `pdf` |
| `GET` | `/api/comparison_data` | All-user leaderboard data |

---

## 🚀 Getting Started (Local)

### Prerequisites

- Python 3.10
- Webcam
- pip

### 1. Clone the repo

```bash
git clone https://github.com/theansh99999/Study-Focus.git
cd Study-Focus
```

### 2. Create virtual environment

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# Mac/Linux
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

> **Note for Windows:** Use `mediapipe` instead of `mediapipe-silicon` in `requirements.txt` if you're not on Apple Silicon.

### 4. Run the app

```bash
python app.py
```

Open your browser → `http://localhost:5000`

---


## 🖥️ How to Use

1. **Login** — Enter your username (auto-creates profile if new)
2. **Grant Camera Permission** — Browser will ask on first start
3. **Configure Settings** *(optional)*:
   - Set your daily focus goal (minutes)
   - Adjust eye closure alert threshold (seconds)
4. **Click "Start Monitoring"** — Camera feed activates and detection begins
5. **Watch the Dashboard** — Stats update live every 5 seconds
6. **Stop Monitoring** — Session is saved and durations calculated
7. **Export Data** — Download CSV or PDF report from dashboard

---

## 🔍 Detection Details

### EAR (Eye Aspect Ratio)
The app calibrates a personal baseline EAR over the first 50 frames, then uses `baseline × 0.7` as the dynamic threshold. This adapts to each user's natural eye openness.

### Gaze Tracking
Uses MediaPipe's iris refinement landmarks (468–477). Iris horizontal position within eye socket is compared against configurable L/R thresholds (`0.38`). If gaze is off-center, a visual warning appears immediately; if sustained for >10s, it's logged as a `looking_away` distraction event.

### Posture Classification
Uses shoulder landmarks (11, 12) and nose (0) from MediaPipe Pose:
- **Slouching**: Nose Y close to or below shoulder midpoint Y, or shoulders very low in frame
- **Leaning**: High shoulder tilt ratio (one shoulder significantly higher than other)
- **Straight**: Normal posture

A 7-frame majority vote smooths out transient misclassifications.

---

## 🐛 Troubleshooting

| Problem | Solution |
|---|---|
| Camera not found | Make sure no other app is using the webcam; try refreshing |
| YOLO model not loading | Ensure `yolov8n.pt` is in the project root directory |
| `mediapipe-silicon` install fails | Replace with `mediapipe` in `requirements.txt` (Windows/Linux) |
| High CPU usage | YOLO runs at 640px; reduce `imgsz` in `detect_objects_with_yolo()` |
| False eye-closure alerts | Increase `BASELINE_FRAMES` or raise `EAR_DYNAMIC_MULTIPLIER` |
| Too many gaze alerts | Increase `GAZE_LR_THRESHOLD` or `GAZE_DISTRACTION_THRESHOLD` |

---

## 🚧 Planned Features (Roadmap)

- [ ] **Yawning / Drowsiness Detection** — Mouth open detection via FaceMesh
- [ ] **Hand Activity Tracking** — Hand near face = phone probability
- [ ] **Sound-based Distraction** — Mic input for talking/noise detection
- [ ] **Focus Score System** — Weighted composite score (eye, phone, gaze, posture)
- [ ] **Smart Alerts** — Tiered alert system (10s = ignore, 30s = warn, 60s = strong)
- [ ] **Break Recommendation** — Notify after 40+ min continuous focus (Pomodoro-style)
- [ ] **Tab / App Switching Detection** — `visibilitychange` API integration
- [ ] **Peak Focus Hours Analytics** — Identify your best study time windows
- [ ] **User Authentication** — Password-protected accounts

---

## 🌐 Browser Compatibility

| Browser | Support |
|---|---|
| Chrome / Chromium | ✅ Full (recommended) |
| Firefox | ✅ Full |
| Edge | ✅ Full |
| Safari (macOS) | ✅ Full |

> ⚠️ Camera access over HTTP works on `localhost`. For any networked deployment, **HTTPS is required** (browser security policy).

---
## Demo link
Youtube link https://youtu.be/WuDIWtNUqpI?si=XWx9Vu74j8ddw-n4

## 👨‍💻 Author

**Ansh Kumar Rai**
Connect me on Linkedin https://www.linkedin.com/in/anshkumarrai/
---

## 📄 License

This project is for educational and personal use. Feel free to fork and build on it.
