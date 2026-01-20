// ===============================
// MONITORING DASHBOARD APP
// ===============================
import { checkAuth, logout, getUserEmail, getUserName, getUserRole } from './auth.js';
import { db } from './firebase-config.js';
import { 
  doc, 
  collection,
  onSnapshot,
  setDoc,
  query,
  orderBy,
  limit,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ===============================
// GLOBAL VARIABLES
// ===============================
let moistureData = [];
let chart = null;
let timeRange = 'minute';
let unsubscribeSensor = null;
let currentMode = 'otomatis';
let pumpStatus = 'OFF';
let minThresholdValue = 30;
let maxThresholdValue = 70;

// ===============================
// INITIALIZE APP
// ===============================
document.addEventListener('DOMContentLoaded', () => {
  // Check authentication
  checkAuth((user, userData) => {
    console.log('User authenticated:', userData);
    initializeDashboard(userData);
  });
});

// ===============================
// INITIALIZE DASHBOARD
// ===============================
function initializeDashboard(userData) {
  // Display user info
  displayUserInfo(userData);
  
  // Initialize chart
  initializeChart();
  
  // Start listening to sensor data
  startSensorListener();
  
  // Start listening to history data
  startHistoryListener();
  
  console.log('Dashboard initialized successfully');
}

// ===============================
// DISPLAY USER INFO
// ===============================
function displayUserInfo(userData) {
  const userEmailEl = document.getElementById('userEmail');
  const userRoleEl = document.getElementById('userRole');
  
  if (userEmailEl) {
    userEmailEl.textContent = userData.email || getUserEmail();
  }
  
  if (userRoleEl) {
    const role = userData.role || getUserRole();
    userRoleEl.textContent = role === 'admin' ? 'Administrator' : 'User';
  }
}

// ===============================
// INITIALIZE CHART
// ===============================
function initializeChart() {
  const ctx = document.getElementById('moistureChart');
  if (!ctx) return;
  
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Sensor 1',
          data: [],
          borderColor: '#007bff',
          backgroundColor: 'rgba(0, 123, 255, 0.1)',
          tension: 0.4
        },
        {
          label: 'Sensor 2',
          data: [],
          borderColor: '#28a745',
          backgroundColor: 'rgba(40, 167, 69, 0.1)',
          tension: 0.4
        },
        {
          label: 'Sensor 3',
          data: [],
          borderColor: '#ffc107',
          backgroundColor: 'rgba(255, 193, 7, 0.1)',
          tension: 0.4
        },
        {
          label: 'Rata-rata',
          data: [],
          borderColor: '#dc3545',
          backgroundColor: 'rgba(220, 53, 69, 0.1)',
          tension: 0.4,
          borderWidth: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          title: {
            display: true,
            text: 'Kelembaban (%)'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Waktu'
          }
        }
      }
    }
  });
}

// ===============================
// START SENSOR LISTENER
// ===============================
function startSensorListener() {
  const sensorDocRef = doc(db, 'sensorData', 'current');
  
  unsubscribeSensor = onSnapshot(sensorDocRef, (docSnapshot) => {
    if (docSnapshot.exists()) {
      const data = docSnapshot.data();
      updateDashboard(data);
    } else {
      console.log('No sensor data available');
      setDefaultValues();
    }
  }, (error) => {
    console.error('Error listening to sensor data:', error);
    setDefaultValues();
  });
}

// ===============================
// START HISTORY LISTENER
// ===============================
function startHistoryListener() {
  const historyRef = collection(db, 'sensorHistory');
  const historyQuery = query(historyRef, orderBy('timestamp', 'desc'), limit(100));
  
  onSnapshot(historyQuery, (snapshot) => {
    moistureData = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      moistureData.push({
        timestamp: data.timestamp?.toDate() || new Date(),
        sensor1: data.sensor1 || 0,
        sensor2: data.sensor2 || 0,
        sensor3: data.sensor3 || 0,
        moisture: data.average || 0,
        pumpStatus: data.pumpStatus || 'OFF',
        mode: data.mode || 'otomatis'
      });
    });
    
    // Sort by timestamp ascending for chart
    moistureData.sort((a, b) => a.timestamp - b.timestamp);
    
    // Update chart and table
    updateChart();
    updateTable(snapshot.docs);
  }, (error) => {
    console.error('Error listening to history:', error);
  });
}

// ===============================
// UPDATE DASHBOARD
// ===============================
function updateDashboard(data) {
  // Update sensor values
  const sensor1Value = data.sensor1 || 0;
  const sensor2Value = data.sensor2 || 0;
  const sensor3Value = data.sensor3 || 0;
  const averageValue = data.average || 0;
  
  document.getElementById('sensor1Value').textContent = sensor1Value + '%';
  document.getElementById('sensor2Value').textContent = sensor2Value + '%';
  document.getElementById('sensor3Value').textContent = sensor3Value + '%';
  document.getElementById('averageValue').textContent = averageValue + '%';
  
  // Update pump status
  pumpStatus = data.pumpStatus || 'OFF';
  currentMode = data.mode || 'otomatis';
  
  updatePumpDisplay();
  updateModeDisplay();
  
  // Update moisture alert
  const alertDiv = document.getElementById('moistureAlert');
  if (alertDiv) {
    if (averageValue < minThresholdValue) {
      alertDiv.className = 'alert danger';
      alertDiv.innerHTML = '<span>⚠️</span><span><strong>KERING!</strong> Pompa akan aktif otomatis</span>';
    } else if (averageValue > maxThresholdValue) {
      alertDiv.className = 'alert warning';
      alertDiv.innerHTML = '<span>💧</span><span><strong>Terlalu Basah!</strong> Perhatikan drainase</span>';
    } else {
      alertDiv.className = 'alert success';
      alertDiv.innerHTML = '<span>✓</span><span><strong>Kelembaban Normal</strong> - Kondisi optimal</span>';
    }
  }
}

// ===============================
// SET DEFAULT VALUES
// ===============================
function setDefaultValues() {
  document.getElementById('sensor1Value').textContent = '0%';
  document.getElementById('sensor2Value').textContent = '0%';
  document.getElementById('sensor3Value').textContent = '0%';
  document.getElementById('averageValue').textContent = '0%';
  document.getElementById('pumpStatusDisplay').textContent = 'OFF';
  document.getElementById('modeDisplay').textContent = 'Otomatis';
}

// ===============================
// UPDATE PUMP DISPLAY
// ===============================
function updatePumpDisplay() {
  const statusDisplay = document.getElementById('pumpStatusDisplay');
  const indicator = document.getElementById('pumpIndicator');
  
  if (!statusDisplay || !indicator) return;
  
  if (pumpStatus === 'ON') {
    statusDisplay.textContent = 'ON';
    statusDisplay.className = 'status-value on';
    indicator.className = 'status-indicator online';
    indicator.innerHTML = '<div class="status-dot online"></div><span>Pompa Aktif</span>';
  } else {
    statusDisplay.textContent = 'OFF';
    statusDisplay.className = 'status-value off';
    indicator.className = 'status-indicator offline';
    indicator.innerHTML = '<div class="status-dot offline"></div><span>Pompa Mati</span>';
  }
}

// ===============================
// UPDATE MODE DISPLAY
// ===============================
function updateModeDisplay() {
  const modeDisplay = document.getElementById('modeDisplay');
  const modeIndicator = document.getElementById('modeIndicator');
  const modeDescription = document.getElementById('modeDescription');
  const manualPanel = document.getElementById('manualControlPanel');
  const autoBtn = document.getElementById('autoModeBtn');
  const manualBtn = document.getElementById('manualModeBtn');
  
  if (!modeDisplay) return;
  
  // Remove active class from all buttons
  if (autoBtn) autoBtn.classList.remove('active');
  if (manualBtn) manualBtn.classList.remove('active');
  
  if (currentMode === 'otomatis') {
    modeDisplay.textContent = 'Otomatis';
    if (modeIndicator) {
      modeIndicator.className = 'status-indicator online';
      modeIndicator.innerHTML = '<div class="status-dot online"></div><span>Mode Otomatis Aktif</span>';
    }
    if (modeDescription) {
      modeDescription.className = 'alert success';
      modeDescription.innerHTML = '<span>⚡</span><span><strong>Mode Otomatis:</strong> Sistem menyiram otomatis berdasarkan sensor</span>';
    }
    if (manualPanel) manualPanel.style.display = 'none';
    if (autoBtn) autoBtn.classList.add('active');
  } else {
    modeDisplay.textContent = 'Manual';
    if (modeIndicator) {
      modeIndicator.className = 'status-indicator info';
      modeIndicator.innerHTML = '<div class="status-dot" style="background: #17a2b8;"></div><span>Mode Manual Aktif</span>';
    }
    if (modeDescription) {
      modeDescription.className = 'alert warning';
      modeDescription.innerHTML = '<span>🎮</span><span><strong>Mode Manual:</strong> Anda mengendalikan pompa secara manual</span>';
    }
    if (manualPanel) manualPanel.style.display = 'block';
    if (manualBtn) manualBtn.classList.add('active');
  }
}

// ===============================
// UPDATE CHART
// ===============================
function updateChart() {
  if (!chart) return;
  
  const displayData = getDataByTimeRange();
  
  chart.data.labels = displayData.map(d => formatTime(d.timestamp));
  chart.data.datasets[0].data = displayData.map(d => d.sensor1);
  chart.data.datasets[1].data = displayData.map(d => d.sensor2);
  chart.data.datasets[2].data = displayData.map(d => d.sensor3);
  chart.data.datasets[3].data = displayData.map(d => d.moisture);
  chart.update('none');
}

// ===============================
// GET DATA BY TIME RANGE
// ===============================
function getDataByTimeRange() {
  const now = new Date();
  return moistureData.filter(d => {
    const diff = now - d.timestamp;
    switch(timeRange) {
      case 'minute': return diff < 3600000; // 1 hour
      case 'hour': return diff < 86400000; // 24 hours
      case 'day': return diff < 2592000000; // 30 days
      case 'week': return diff < 7776000000; // 90 days
      default: return true;
    }
  });
}

// ===============================
// CHANGE TIME RANGE
// ===============================
window.changeTimeRange = function(range) {
  timeRange = range;
  document.querySelectorAll('.time-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  
  const infoText = document.getElementById('chartInfoText');
  if (infoText) {
    switch(range) {
      case 'minute':
        infoText.textContent = 'Menampilkan data per menit (1 jam terakhir)';
        break;
      case 'hour':
        infoText.textContent = 'Menampilkan data per jam (24 jam terakhir)';
        break;
      case 'day':
        infoText.textContent = 'Menampilkan data per hari (30 hari terakhir)';
        break;
      case 'week':
        infoText.textContent = 'Menampilkan data per minggu (12 minggu terakhir)';
        break;
    }
  }
  
  updateChart();
}

// ===============================
// UPDATE TABLE
// ===============================
function updateTable(docs) {
  const tbody = document.getElementById('tableBody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  if (docs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #6c757d;">Belum ada data</td></tr>';
    return;
  }
  
  docs.forEach(docSnapshot => {
    const data = docSnapshot.data();
    const row = tbody.insertRow();
    row.insertCell(0).textContent = formatDateTime(data.timestamp?.toDate());
    row.insertCell(1).textContent = (data.sensor1 || 0) + '%';
    row.insertCell(2).textContent = (data.sensor2 || 0) + '%';
    row.insertCell(3).textContent = (data.sensor3 || 0) + '%';
    row.insertCell(4).textContent = (data.average || 0) + '%';
    
    const pumpCell = row.insertCell(5);
    pumpCell.textContent = data.pumpStatus || 'OFF';
    pumpCell.style.fontWeight = 'bold';
    pumpCell.style.color = data.pumpStatus === 'ON' ? '#28a745' : '#dc3545';
    
    row.insertCell(6).textContent = data.mode === 'otomatis' ? 'Otomatis' : 'Manual';
  });
}

// ===============================
// SET MODE
// ===============================
window.setMode = async function(mode) {
  try {
    const sensorDocRef = doc(db, 'sensorData', 'current');
    await setDoc(sensorDocRef, { mode: mode }, { merge: true });
    currentMode = mode;
    updateModeDisplay();
    console.log('Mode changed to:', mode);
  } catch (error) {
    console.error('Error setting mode:', error);
    alert('Gagal mengubah mode: ' + error.message);
  }
}

// ===============================
// CONTROL PUMP
// ===============================
window.controlPump = async function(status) {
  if (currentMode !== 'manual') {
    alert('⚠️ Pompa hanya bisa dikontrol manual saat Mode Manual aktif!');
    return;
  }
  
  try {
    const sensorDocRef = doc(db, 'sensorData', 'current');
    await setDoc(sensorDocRef, { 
      pumpStatus: status,
      lastUpdate: serverTimestamp()
    }, { merge: true });
    
    pumpStatus = status;
    updatePumpDisplay();
    console.log('Pump status changed to:', status);
  } catch (error) {
    console.error('Error controlling pump:', error);
    alert('Gagal mengontrol pompa: ' + error.message);
  }
}

// ===============================
// EXPORT TO EXCEL
// ===============================
window.exportToExcel = function() {
  const ws_data = [['Waktu', 'Sensor 1 (%)', 'Sensor 2 (%)', 'Sensor 3 (%)', 'Rata-rata (%)', 'Status Pompa', 'Mode']];
  
  moistureData.forEach(data => {
    ws_data.push([
      formatDateTime(data.timestamp),
      data.sensor1,
      data.sensor2,
      data.sensor3,
      data.moisture,
      data.pumpStatus,
      data.mode === 'otomatis' ? 'Otomatis' : 'Manual'
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data Kelembaban");
  
  const fileName = 'data_kelembaban_tanah_' + new Date().toISOString().split('T')[0] + '.xlsx';
  XLSX.writeFile(wb, fileName);
  console.log('Data exported to Excel:', fileName);
}

// ===============================
// HANDLE LOGOUT
// ===============================
window.handleLogout = async function() {
  if (confirm('Yakin ingin logout?')) {
    try {
      if (unsubscribeSensor) unsubscribeSensor();
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
      alert('Gagal logout: ' + error.message);
    }
  }
}

// ===============================
// HELPER FUNCTIONS
// ===============================
function formatTime(date) {
  if (!date) return '--';
  return date.toLocaleTimeString('id-ID');
}

function formatDateTime(date) {
  if (!date) return '--';
  return date.toLocaleString('id-ID');
}

// ===============================
// CLEANUP ON PAGE UNLOAD
// ===============================
window.addEventListener('beforeunload', () => {
  if (unsubscribeSensor) {
    unsubscribeSensor();
  }
});