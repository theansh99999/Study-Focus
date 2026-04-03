class FocusMonitor {
    constructor() {
        this.currentUser = null;
        this.monitoringActive = false;
        this.dashboardData = null;
        this.charts = {};
        this.alertSound = null;
        this.updateInterval = null;
        this.leaderboardPage = 1;
        this.leaderboardPageSize = 4;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.initTheme();
        this.showLoginModal();
        this.createAlertSound();
    }
    
    setupEventListeners() {
        // Login / Logout
        document.getElementById('loginBtn').addEventListener('click', () => this.login());
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
        document.getElementById('username').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.login();
        });
        
        // Monitoring controls
        document.getElementById('startBtn').addEventListener('click', () => this.startMonitoring());
        document.getElementById('stopBtn').addEventListener('click', () => this.stopMonitoring());
        
        // Settings
        document.getElementById('saveSettings').addEventListener('click', () => this.saveSettings());
        
        // Actions
        document.getElementById('resetDataBtn').addEventListener('click', () => this.resetUserData());
        
        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
    }
    
    initTheme() {
        // Auto-detect system theme
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const savedTheme = localStorage.getItem('theme');
        const theme = savedTheme || (prefersDark ? 'dark' : 'light');
        
        this.setTheme(theme);
        
        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('theme')) {
                this.setTheme(e.matches ? 'dark' : 'light');
            }
        });
    }
    
    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        const icon = document.getElementById('themeIcon');
        icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        localStorage.setItem('theme', theme);
    }
    
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    }
    
    showLoginModal() {
        const modal = new bootstrap.Modal(document.getElementById('loginModal'));
        modal.show();
    }
    
    async login() {
        const username = document.getElementById('username').value.trim();
        if (!username) {
            this.showAlert('Please enter a username', 'warning');
            return;
        }
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });
            
            const data = await response.json();
            if (data.success) {
                this.currentUser = data.user;
                document.getElementById('currentUser').textContent = username;
                document.getElementById('logoutBtn').style.display = 'block';
                
                // Hide modal and show dashboard
                bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
                document.getElementById('dashboard').style.display = 'block';
                
                // Load user settings and dashboard data
                await this.loadSettings();
                await this.loadDashboardData();
                this.startDataUpdates();
                
                this.showAlert(`Welcome ${username}!`, 'success');
            } else {
                this.showAlert(data.error || 'Login failed', 'danger');
            }
        } catch (error) {
            this.showAlert('Connection error', 'danger');
        }
    }

    async logout() {
        if(this.monitoringActive) {
            await this.stopMonitoring();
        }
        
        try {
            await fetch('/api/logout', { method: 'POST' });
        } catch(e) {}
        
        this.currentUser = null;
        if(this.updateInterval) clearInterval(this.updateInterval);
        if(this.statusInterval) clearInterval(this.statusInterval);
        if (this.alertSound && this.alertSound.stopAlarm) this.alertSound.stopAlarm();
        
        document.getElementById('currentUser').textContent = 'Not logged in';
        document.getElementById('logoutBtn').style.display = 'none';
        document.getElementById('dashboard').style.display = 'none';
        
        this.showLoginModal();
        this.showAlert('Logged out successfully', 'info');
    }
    
    async loadSettings() {
        try {
            const response = await fetch('/api/settings');
            const settings = await response.json();
            
            document.getElementById('dailyGoal').value = settings.daily_goal_minutes;
            document.getElementById('eyeThreshold').value = settings.eye_closure_threshold;
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }
    
    async saveSettings() {
        const dailyGoal = parseInt(document.getElementById('dailyGoal').value);
        const eyeThreshold = parseFloat(document.getElementById('eyeThreshold').value);
        
        try {
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    daily_goal_minutes: dailyGoal,
                    eye_closure_threshold: eyeThreshold
                })
            });
            
            const data = await response.json();
            if (data.success) {
                this.showAlert('Settings saved!', 'success');
                await this.loadDashboardData(); // Refresh dashboard
            }
        } catch (error) {
            this.showAlert('Failed to save settings', 'danger');
        }
    }
    
    async startMonitoring() {
        if (this.alertSound && this.alertSound.ctx && this.alertSound.ctx.state === 'suspended') {
            this.alertSound.ctx.resume();
        }
        try {
            const response = await fetch('/api/start_monitoring', { method: 'POST' });
            const data = await response.json();
            
            if (data.success) {
                this.monitoringActive = true;
                document.getElementById('startBtn').style.display = 'none';
                document.getElementById('stopBtn').style.display = 'block';
                document.getElementById('monitoringStatus').innerHTML = 
                    '<i class="fas fa-video me-2"></i>Monitoring active...';
                document.getElementById('monitoringStatus').className = 'alert alert-success monitoring-active';
                document.getElementById('liveIndicator').style.display = 'block';
                
                // Mount Video Stream
                const streamImg = document.getElementById('cameraStream');
                streamImg.src = '/video_feed?' + new Date().getTime();
                streamImg.style.display = 'block';
                document.getElementById('cameraPlaceholder').style.display = 'none';
                
                this.showAlert('Monitoring started!', 'success');
            } else {
                this.showAlert(data.error || 'Failed to start monitoring', 'danger');
            }
        } catch (error) {
            this.showAlert('Connection error', 'danger');
        }
    }
    
    async stopMonitoring() {
        try {
            const response = await fetch('/api/stop_monitoring', { method: 'POST' });
            const data = await response.json();
            
            if (data.success) {
                this.monitoringActive = false;
                
                // Clear active alarms
                if (this.alertSound && this.alertSound.stopAlarm) this.alertSound.stopAlarm();
                document.body.classList.remove('alert-shake');
                document.body.style.backgroundColor = '';
                
                document.getElementById('startBtn').style.display = 'block';
                document.getElementById('stopBtn').style.display = 'none';
                document.getElementById('monitoringStatus').innerHTML = 
                    '<i class="fas fa-info-circle me-2"></i>Ready to start';
                document.getElementById('monitoringStatus').className = 'alert alert-info';
                document.getElementById('liveIndicator').style.display = 'none';
                
                // Unmount Video Stream
                const streamImg = document.getElementById('cameraStream');
                streamImg.src = '';
                streamImg.style.display = 'none';
                document.getElementById('cameraPlaceholder').style.display = 'block';
                
                this.showAlert('Monitoring stopped!', 'info');
                await this.loadDashboardData(); // Refresh data
            }
        } catch (error) {
            this.showAlert('Connection error', 'danger');
        }
    }
    
    async loadDashboardData() {
        try {
            const response = await fetch('/api/dashboard_data');
            const data = await response.json();
            
            if (data.error) {
                console.error('Dashboard data error:', data.error);
                return;
            }
            
            this.dashboardData = data;
            this.updateDashboard();
            this.updateCharts();
            
            // Check for new alerts
            if (data.recent_events.length > 0) {
                const latestEvent = data.recent_events[0];
                const eventTime = new Date(latestEvent.timestamp);
                const now = new Date();
                
                // If event is within last 10 seconds, show alert
                if (now - eventTime < 10000) {
                    this.triggerAlert(latestEvent.type);
                }
            }
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        }
    }
    
    updateDashboard() {
        const data = this.dashboardData;
        
        // Update stats cards
        document.getElementById('focusTime').textContent = `${Math.round(data.total_focus_time / 60)} min`;
        document.getElementById('distractionTime').textContent = `${Math.round(data.total_distraction_time / 60)} min`;
        document.getElementById('eyeAlerts').textContent = data.event_breakdown.eye_closed;
        document.getElementById('phoneAlerts').textContent = data.event_breakdown.phone_detected;
        
        const totalMinutes = Math.round((data.total_focus_time + data.total_distraction_time) / 60);
        const totalAlertsCount = data.event_breakdown.eye_closed + data.event_breakdown.phone_detected;
        if (document.getElementById('totalTime')) document.getElementById('totalTime').textContent = `${totalMinutes} min`;
        if (document.getElementById('totalAlerts')) document.getElementById('totalAlerts').textContent = totalAlertsCount;
        
        // Update goal progress
        const progressBar = document.getElementById('goalProgress');
        const progressText = document.getElementById('goalProgressText');
        const goalText = document.getElementById('goalText');
        
        progressBar.style.width = `${data.goal_progress}%`;
        progressText.textContent = `${Math.round(data.goal_progress)}%`;
        goalText.textContent = `Goal: ${data.daily_goal} minutes`;
        
        // Update events table
        this.updateEventsTable(data.recent_events);
        
        // Update camera focus/distraction state
        const cameraContainer = document.getElementById('cameraContainer');
        if (cameraContainer) {
            cameraContainer.classList.remove('camera-focused', 'camera-distracted');
            
            if (data.monitoring_active) {
                let isDistracted = false;
                if (data.recent_events && data.recent_events.length > 0) {
                    const latestEvent = data.recent_events[0];
                    const eventTime = new Date(latestEvent.timestamp);
                    const now = new Date();
                    // Distracted if the newest event occurred within the last 10 seconds
                    if (now - eventTime < 10000) {
                        isDistracted = true;
                    }
                }
                
                if (isDistracted) {
                    cameraContainer.classList.add('camera-distracted');
                } else {
                    cameraContainer.classList.add('camera-focused');
                }
            }
        }
    }
    
    updateEventsTable(events) {
        const container = document.getElementById('eventsTable');
        
        if (events.length === 0) {
            container.innerHTML = '<div class="text-center text-muted py-4">No events yet</div>';
            return;
        }
        
        container.innerHTML = events.map(event => {
            const time = new Date(event.timestamp).toLocaleTimeString();
            const isEye = event.type === 'eye_closed';
            const eventIcon = isEye ? 'fa-eye-slash' : 'fa-mobile-alt';
            const eventName = isEye ? 'Eyes Closed Too Long' : 'Phone Detected';
            const alertClass = isEye ? 'alert-warning' : 'alert-danger text-white';
            const duration = isEye ? `${event.duration.toFixed(1)}s` : '-';
            
            // Check if event is brand new (happened in last 5.5 seconds) to apply animation
            const now = new Date();
            const eventTime = new Date(event.timestamp);
            const isNew = (now - eventTime) < 5500; 
            const animationClass = isNew ? 'slide-in' : '';

            return `
                <div class="alert ${alertClass} ${animationClass} mb-2 shadow-sm border-0 p-3 rounded-3">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <strong style="font-size: 0.9rem;"><i class="fas ${eventIcon} me-2"></i>${eventName}</strong>
                        <small style="font-size: 0.75rem; opacity: 0.85;">${time}</small>
                    </div>
                    ${isEye ? `<div style="font-size: 0.8rem; opacity: 0.9;">Duration: ${duration}</div>` : ''}
                </div>
            `;
        }).join('');
    }
    
    updateCharts() {
        this.updateFocusChart();
        this.updateDistractionChart();
        this.updateLeaderboard();
    }
    
    updateFocusChart() {
        const ctx = document.getElementById('focusChart').getContext('2d');
        const data = this.dashboardData;
        
        if (this.charts.focus) {
            this.charts.focus.destroy();
        }
        
        this.charts.focus = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Focus Time', 'Distraction Time'],
                datasets: [{
                    data: [data.total_focus_time / 60, data.total_distraction_time / 60],
                    backgroundColor: ['#28a745', '#dc3545'],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }
    
    updateDistractionChart() {
        const ctx = document.getElementById('distractionChart').getContext('2d');
        const data = this.dashboardData;
        
        if (this.charts.distraction) {
            this.charts.distraction.destroy();
        }
        
        this.charts.distraction = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['👀 Eyes Closed', '📱 Phone Usage'],
                datasets: [{
                    data: [data.event_breakdown.eye_closed, data.event_breakdown.phone_detected],
                    backgroundColor: ['#ffc107', '#fd7e14'],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }
    
    async updateLeaderboard() {
        try {
            const response = await fetch('/api/comparison_data');
            const leaderboardData = await response.json();
            
            this.fullLeaderboardData = leaderboardData;
            this.renderLeaderboard();
            
            // Set up search listener once
            if (!this.searchConfigured) {
                document.getElementById('leaderboardSearch').addEventListener('input', (e) => {
                    this.leaderboardSearchText = e.target.value.toLowerCase();
                    this.renderLeaderboard();
                });
                this.searchConfigured = true;
            }
        } catch (error) {
            console.error('Failed to load leaderboard data:', error);
        }
    }
    
    changeLeaderboardPage(delta) {
        this.leaderboardPage += delta;
        if (this.leaderboardPage < 1) this.leaderboardPage = 1;
        this.renderLeaderboard();
    }
    
    renderLeaderboard() {
        const tbody = document.getElementById('leaderboardTableBody');
        if (!tbody || !this.fullLeaderboardData) return;
        
        const searchText = this.leaderboardSearchText || '';
        
        // 1. Assign true reality rank
        const correctlyRanked = this.fullLeaderboardData.map((u, i) => ({...u, trueRank: i + 1}));
        
        // 2. Filter search text
        let filteredUsers = correctlyRanked.filter(user => user.username.toLowerCase().includes(searchText));
        
        // 3. Extract the currentUser safely so they aren't randomly paginated away
        const currentUserName = this.currentUser ? this.currentUser.username : null;
        const currentUserObj = correctlyRanked.find(u => u.username === currentUserName);
        let allExceptCurrent = filteredUsers.filter(u => u.username !== currentUserName);
        
        // Pagination logic
        const totalPages = Math.max(1, Math.ceil(allExceptCurrent.length / this.leaderboardPageSize));
        if (this.leaderboardPage > totalPages) this.leaderboardPage = totalPages;
        
        const startIndex = (this.leaderboardPage - 1) * this.leaderboardPageSize;
        const pageUsers = allExceptCurrent.slice(startIndex, startIndex + this.leaderboardPageSize);
        
        // DOM Generation function for row
        const createRow = (user, isPinned = false) => {
            const isCurrent = user.username === currentUserName;
            const rowClass = isPinned ? 'table-primary fw-bold text-dark' : (isCurrent ? 'table-primary fw-bold bg-opacity-10' : '');
            
            let completionPercent = 0;
            if (user.daily_goal_minutes > 0) {
                completionPercent = Math.min(100, Math.round((user.focus_time / user.daily_goal_minutes) * 100));
            }
            
            return `<tr class="${rowClass}">
                <td class="ps-4 fw-bold">#${user.trueRank}</td>
                <td>
                    <span class="d-flex align-items-center">
                        ${isCurrent ? '<i class="fas fa-star text-warning me-2"></i>' : ''}
                        ${user.username}
                        ${isPinned ? '<span class="badge bg-primary ms-2 shadow-sm">You</span>' : ''}
                    </span>
                </td>
                <td>${user.daily_goal_minutes} min</td>
                <td class="text-success fw-bold">${Math.round(user.focus_time)} min</td>
                <td class="text-danger">${Math.round(user.distraction_time)} min</td>
                <td class="pe-4 text-end">
                    <span class="${completionPercent >= 100 ? 'text-success fw-bold' : ''}">${completionPercent}%</span>
                </td>
            </tr>`;
        };
        
        let htmlContext = pageUsers.map(u => createRow(u, false)).join('');
        
        // Pad with completely empty invisible rows to guarantee 4 visual slots before the 5th pinned row
        const emptyRowsNeeded = this.leaderboardPageSize - pageUsers.length;
        for (let i = 0; i < emptyRowsNeeded; i++) {
            htmlContext += `<tr>
                <td class="text-muted opacity-25"># -</td>
                <td class="text-muted opacity-25">-</td>
                <td class="text-muted opacity-25">-</td>
                <td class="text-muted opacity-25">-</td>
                <td class="text-muted opacity-25">-</td>
                <td class="text-muted opacity-25 text-end">-</td>
            </tr>`;
        }

        // 4. Pin 5th entry accurately at bottom
        if (currentUserObj) {
            htmlContext += '<tr style="border-top: 3px solid rgba(0,0,0,0.1);"><td colspan="6" class="p-0"></td></tr>';
            htmlContext += createRow(currentUserObj, true);
        }
        
        tbody.innerHTML = htmlContext;
        
        // Update pagination UI constraints
        const pageInfo = document.getElementById('leaderboardPageInfo');
        if (pageInfo) pageInfo.textContent = `Page ${this.leaderboardPage} of ${totalPages}`;
        const btnPrev = document.getElementById('btnPrevPage');
        if (btnPrev) btnPrev.disabled = this.leaderboardPage <= 1;
        const btnNext = document.getElementById('btnNextPage');
        if (btnNext) btnNext.disabled = this.leaderboardPage >= totalPages;
    }
    
    triggerAlert(eventType) {
        // Visual toast notification
        const alertMessage = eventType === 'eye_closed' ? 
            '👀 WAKE UP! Eyes closed too long!' : 
            '📱 Phone detected! Put it away!';
        
        document.getElementById('alertMessage').textContent = alertMessage;
        const toast = new bootstrap.Toast(document.getElementById('alertToast'));
        toast.show();
    }
    
    createAlertSound() {
        // Create a simple beep sound using Web Audio API
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            this.alertSound = {
                ctx: audioContext,
                beepInterval: null,
                isPlaying: false,
                startAlarm: () => {
                    if (audioContext.state === 'suspended') audioContext.resume();
                    if (this.alertSound.isPlaying) return;
                    this.alertSound.isPlaying = true;

                    const playBeep = () => {
                        const oscillator = audioContext.createOscillator();
                        const gainNode = audioContext.createGain();
                        
                        oscillator.connect(gainNode);
                        gainNode.connect(audioContext.destination);
                        
                        oscillator.frequency.value = 800; // Ear-piercing
                        oscillator.type = 'square'; // Extremely harsh
                        
                        gainNode.gain.setValueAtTime(1.0, audioContext.currentTime); // LOUD
                        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                        
                        oscillator.start(audioContext.currentTime);
                        oscillator.stop(audioContext.currentTime + 0.3);
                    };

                    playBeep();
                    this.alertSound.beepInterval = setInterval(playBeep, 400); // 400ms barrage
                },
                stopAlarm: () => {
                    this.alertSound.isPlaying = false;
                    if (this.alertSound.beepInterval) {
                        clearInterval(this.alertSound.beepInterval);
                        this.alertSound.beepInterval = null;
                    }
                }
            };
        } catch (error) {
            console.log('Web Audio API not supported');
        }
    }
    
    startDataUpdates() {
        // Update dashboard tabular data every 5 seconds
        this.updateInterval = setInterval(() => {
            this.loadDashboardData();
        }, 5000);
        
        // Fast status polling for real-time continuous alarms (every 500ms)
        this.statusInterval = setInterval(async () => {
            if (!this.monitoringActive) return;
            try {
                const response = await fetch('/api/status');
                const data = await response.json();
                
                if (data.eye_closed || data.phone_detected) {
                    if (this.alertSound && this.alertSound.startAlarm) this.alertSound.startAlarm();
                    document.body.classList.add('alert-shake');
                    // Flash deep red visually to accompany the alarm
                    document.body.style.backgroundColor = '#4a0404';
                } else {
                    if (this.alertSound && this.alertSound.stopAlarm) this.alertSound.stopAlarm();
                    document.body.classList.remove('alert-shake');
                    document.body.style.backgroundColor = '';
                }
            } catch(e) {}
        }, 500);
    }
    
    async resetUserData() {
        if (!confirm('Are you sure you want to reset all your data? This cannot be undone.')) {
            return;
        }
        
        try {
            const response = await fetch('/api/reset_user_data', { method: 'POST' });
            const data = await response.json();
            
            if (data.success) {
                this.showAlert('Data reset successfully!', 'success');
                await this.loadDashboardData();
            }
        } catch (error) {
            this.showAlert('Failed to reset data', 'danger');
        }
    }
    
    showAlert(message, type) {
        // Create and show Bootstrap alert
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        // Insert at top of dashboard
        const dashboard = document.getElementById('dashboard');
        dashboard.insertBefore(alertDiv, dashboard.firstChild);
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }
}

// Export data function
async function exportData(format) {
    try {
        const response = await fetch(`/api/export_data/${format}`);
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `focus_data.${format}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }
    } catch (error) {
        console.error('Export failed:', error);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.focusMonitorApp = new FocusMonitor();
});