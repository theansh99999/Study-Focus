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
- Interactive charts (Line, Pie, Progress bar with Chart.js)  
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

## 📥 Installation

Clone the repository:
```bash
git clone <repository-url>
cd focus-monitor
