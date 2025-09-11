# 🎯 Focus Monitor - Productivity & Focus Monitoring App

A comprehensive Flask-based application that monitors your productivity and focus using **Computer Vision (OpenCV + Mediapipe + YOLO)** to detect distractions like **eye closure** and **phone usage**.

⚠️ **Note:** Multi-person detection is implemented using YOLO, but currently under bug fixing (work in progress).

---

## ✨ Features

### 🔐 User Management
- Username-based login (no password required)
- Automatic user profile creation
- Data reset functionality for existing users

### 👁️ Core Monitoring (OpenCV + Mediapipe + YOLO)
- **Eye Closure Detection** → Alerts when eyes remain closed for more than 3 seconds  
- **Phone Detection** → Alerts when a phone is detected in the camera frame  
- **Multi-person Support** → Detects events for anyone in the camera view *(currently fixing bug)*  
- **Real-time Event Logging** → Records all events with timestamps and user info  

### 📊 Distraction Categories
- Eye Closed Too Long 👀 (Drowsiness & fatigue)
- Phone Usage 📱 (Mobile distractions)
- Category-wise statistics & breakdown in dashboard  

### 🎨 UI/UX Features
- Dark/Light mode toggle (manual + auto system detection)
- Real-time dashboard with live alerts  
- Interactive charts (Line, Pie, Progress bar with app.js)  
- Goal tracking (daily/weekly) with visualization  
- Export functionality: CSV/Excel & PDF report generation  
- Responsive design (desktop & laptop friendly)  

### 🚀 Advanced Features
- Session tracking with analytics  
- Multi-user comparison dashboard  
- Customizable thresholds for eye closure  
- Dual alerts → Audio beep + Visual popup  
- Real-time updates (dashboard refreshes every 5s)  

---

## 🛠️ Tech Stack
- **Backend:** Flask (Python)  
- **Frontend:** HTML5, CSS3, JavaScript, Bootstrap 5  
- **Charts:** Chart.js  
- **Computer Vision:** OpenCV + Mediapipe + YOLO  
- **Database:** SQLite  
- **Others:** Web Audio API for alerts, Responsive Design  

---

## Getting Started
- Launch the app and enter your username (no password needed)  
- Grant camera permissions when prompted by your browser  
- Configure settings like daily goal and eye closure threshold  
- Click **“Start Monitoring”** to begin focus tracking  

## Monitoring Process
- The app will continuously monitor your webcam feed  
- **Eye Closure**: If your eyes stay closed for longer than the threshold (default 3 seconds), you’ll receive an alert  
- **Phone Detection**: If a phone appears in the camera frame, an immediate alert is triggered  
- All events are logged with precise timestamps for later analysis  

## Dashboard Features
- **Real-time Stats**: Focus time, distraction time, and alert counts  
- **Goal Progress**: Visual progress bar showing daily goal completion  
- **Interactive Charts**:  
  - Focus vs Distraction time (doughnut chart)  
  - Distraction type breakdown (pie chart)  
  - User comparison (bar chart)  
- **Recent Events Table**: Chronological list of all monitoring events  
- **Export Options**: Download your data as CSV or PDF reports  

## Settings & Customization
- **Daily Goal**: Set your target focus time (default: 120 minutes)  
- **Eye Closure Threshold**: Adjust sensitivity (default: 3.0 seconds)  
- **Theme**: Toggle between light/dark modes or use auto-detection  
- **Data Management**: Reset all personal data if needed  

## Project Structure
```
focus-monitor/
├── app.py # Main Flask application
├── requirements.txt # Python dependencies
├── focus_monitor.db # SQLite database (auto-created)
├── templates/
│ └── index.html # Main dashboard template
├── static/
│ ├── css/
│ │ └── style.css # Custom styles and themes
│ └── js/
│ └── app.js # Frontend JavaScript logic
└── README.md # This file
```

## Database Schema

### Users Table
- **id**: Primary key  
- **username**: Unique username  
- **created_at**: Account creation timestamp  
- **daily_goal_minutes**: Personal daily goal  
- **eye_closure_threshold**: Custom threshold setting  

### Sessions Table
- **id**: Primary key  
- **user_id**: Foreign key to users  
- **start_time**: Session start timestamp  
- **end_time**: Session end timestamp  
- **total_duration**: Total session time in seconds  
- **focus_duration**: Productive time in seconds  
- **distraction_duration**: Distracted time in seconds  
- **is_active**: Boolean for active sessions  

### Events Table
- **id**: Primary key  
- **user_id**: Foreign key to users  
- **session_id**: Foreign key to sessions  
- **timestamp**: Event occurrence time  
- **event_type**: `eye_closed` or `phone_detected`  
- **duration**: Event duration in seconds  

## API Endpoints
- **GET /** → Main dashboard page  
- **POST /api/login** → User authentication  
- **POST /api/start_monitoring** → Begin camera monitoring  
- **POST /api/stop_monitoring** → End monitoring session  
- **GET /api/dashboard_data** → Fetch real-time dashboard data  
- **GET/POST /api/settings** → User settings management  
- **POST /api/reset_user_data** → Clear all user data  
- **GET /api/export_data/<format>** → Export data as CSV or PDF  
- **GET /api/comparison_data** → Multi-user comparison data  

## Browser Compatibility
- **Chrome/Chromium**: Full support (recommended)  
- **Firefox**: Full support  
- **Safari**: Full support (macOS)  
- **Edge**: Full support  

⚠️ Note: Camera access requires **HTTPS** in production environments.  

## Troubleshooting

### Camera Issues
- Ensure your camera is not being used by other applications  
- Grant camera permissions when prompted  
- Try refreshing the page if camera access fails  

### Performance
- Close other camera-using applications  
- Ensure good lighting for better face detection  
- Consider adjusting detection thresholds if getting false positives  

### Data Export
- Large datasets may take a moment to generate  
- PDF reports include charts and require matplotlib  
- CSV exports work with any spreadsheet application  

## Future Enhancements
- **Mobile App**: React Native or Flutter mobile version  
- **Advanced Detection**: Posture monitoring, looking away detection  
- **Team Features**: Organization-wide analytics and reporting  
- **Integration**: Calendar integration, productivity app connections  
- **AI Insights**: Personalized productivity recommendations  
- **Cloud Sync**: Multi-device data synchronization  
## 👨‍💻 Created By
**Ansh Kumar Rai**
