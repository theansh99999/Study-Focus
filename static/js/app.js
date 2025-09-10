class FocusMonitor {
    constructor() {
        this.currentUser = null;
        this.monitoringActive = false;
        this.dashboardData = null;
        this.charts = {};
        this.alertSound = null;
        this.updateInterval = null;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.initTheme();
        this.showLoginModal();
        this.createAlertSound();
    }
    
    setupEventListeners() {
        // Login
        document.getElementById('loginBtn').addEventListener('click', () => this.login());
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
                document.getElementById('startBtn').style.display = 'block';
                document.getElementById('stopBtn').style.display = 'none';
                document.getElementById('monitoringStatus').innerHTML = 
                    '<i class="fas fa-info-circle me-2"></i>Ready to start';
                document.getElementById('monitoringStatus').className = 'alert alert-info';
                
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
        
        // Update goal progress
        const progressBar = document.getElementById('goalProgress');
        const progressText = document.getElementById('goalProgressText');
        const goalText = document.getElementById('goalText');
        
        progressBar.style.width = `${data.goal_progress}%`;
        progressText.textContent = `${Math.round(data.goal_progress)}%`;
        goalText.textContent = `Goal: ${data.daily_goal} minutes`;
        
        // Update events table
        this.updateEventsTable(data.recent_events);
    }
    
    updateEventsTable(events) {
        const tbody = document.getElementById('eventsTable');
        
        if (events.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No events yet</td></tr>';
            return;
        }
        
        tbody.innerHTML = events.map(event => {
            const time = new Date(event.timestamp).toLocaleTimeString();
            const eventIcon = event.type === 'eye_closed' ? '👀' : '📱';
            const eventName = event.type === 'eye_closed' ? 'Eyes Closed Too Long' : 'Phone Detected';
            const duration = event.type === 'eye_closed' ? `${event.duration.toFixed(1)}s` : '-';
            
            return `
                <tr>
                    <td>${time}</td>
                    <td>${eventIcon} ${eventName}</td>
                    <td>${duration}</td>
                </tr>
            `;
        }).join('');
    }
    
    updateCharts() {
        this.updateFocusChart();
        this.updateDistractionChart();
        this.updateComparisonChart();
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
    
    async updateComparisonChart() {
        try {
            const response = await fetch('/api/comparison_data');
            const comparisonData = await response.json();
            
            const ctx = document.getElementById('comparisonChart').getContext('2d');
            
            if (this.charts.comparison) {
                this.charts.comparison.destroy();
            }
            
            this.charts.comparison = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: comparisonData.map(user => user.username),
                    datasets: [{
                        label: 'Focus Percentage',
                        data: comparisonData.map(user => user.focus_percentage),
                        backgroundColor: '#007bff',
                        borderColor: '#0056b3',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                                callback: function(value) {
                                    return value + '%';
                                }
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Failed to load comparison data:', error);
        }
    }
    
    triggerAlert(eventType) {
        // Play sound
        if (this.alertSound) {
            this.alertSound.play().catch(e => console.log('Could not play alert sound'));
        }
        
        // Show toast notification
        const alertMessage = eventType === 'eye_closed' ? 
            '👀 Eyes closed too long! Stay focused!' : 
            '📱 Phone detected! Put it away!';
        
        document.getElementById('alertMessage').textContent = alertMessage;
        const toast = new bootstrap.Toast(document.getElementById('alertToast'));
        toast.show();
        
        // Add visual feedback
        document.body.classList.add('alert-shake');
        setTimeout(() => document.body.classList.remove('alert-shake'), 500);
    }
    
    createAlertSound() {
        // Create a simple beep sound using Web Audio API
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            this.alertSound = {
                play: () => {
                    const oscillator = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();
                    
                    oscillator.connect(gainNode);
                    gainNode.connect(audioContext.destination);
                    
                    oscillator.frequency.value = 800;
                    oscillator.type = 'sine';
                    
                    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
                    
                    oscillator.start(audioContext.currentTime);
                    oscillator.stop(audioContext.currentTime + 0.5);
                    
                    return Promise.resolve();
                }
            };
        } catch (error) {
            console.log('Web Audio API not supported');
        }
    }
    
    startDataUpdates() {
        // Update dashboard data every 5 seconds
        this.updateInterval = setInterval(() => {
            this.loadDashboardData();
        }, 5000);
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
    new FocusMonitor();
});