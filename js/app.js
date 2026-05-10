// ===============================
// MONITORING DASHBOARD APP
// ===============================

import { checkAuth, logout, getUserEmail, getUserName, getUserRole } from './auth.js';
import { rtdb } from './firebase-config.js';
import {
  ref,
  onValue,
  set
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// ===============================
// GLOBAL VARIABLES
// ===============================
let moistureData = [];
let chart = null;
let timeRange = 'minute';
let currentMode = 'otomatis'; // 'otomatis' atau 'manual'
let pumpStatus = 'OFF';       // 'ON' atau 'OFF'
let unsubscribeSoil = null;
let unsubscribePump = null;
let unsubscribeMode = null;

const THRESHOLD_KERING = 40; // % kelembaban batas kering

// ===============================
// INITIALIZE APP
// ===============================
document.addEventListener('DOMContentLoaded', () => {
  checkAuth((user, userData) => {
    console.log('User authenticated:', userData);
    initializeDashboard(userData);
  });
});

// ===============================
// INITIALIZE DASHBOARD
// ===============================
function initializeDashboard(userData) {

  displayUserInfo(userData);

  const userRole = userData.role || getUserRole();

  // Sembunyikan tombol export untuk non-admin
  if (userRole !== 'admin') {
    const exportBtn = document.querySelector('.export-btn');
    if (exportBtn) exportBtn.style.display = 'none';
  }

  // Sembunyikan kartu kontrol mode untuk non-admin
  if (userRole !== 'admin') {
    const modeControlCard = document.getElementById('modeControlCard');
    if (modeControlCard) modeControlCard.style.display = 'none';
  }

  initializeChart();
  startRealtimeListeners();

  console.log('✅ Dashboard aktif | Role:', userRole);
}

// ===============================
// DISPLAY USER INFO
// ===============================
function displayUserInfo(userData) {
  const emailEl = document.getElementById('userEmail');
  const roleEl  = document.getElementById('userRole');

  if (emailEl) emailEl.textContent = userData.email || getUserEmail();
  if (roleEl)  roleEl.textContent  = (userData.role || getUserRole()) === 'admin'
    ? 'Administrator'
    : 'User';
}

// ===============================
// REALTIME LISTENERS
// ===============================
function startRealtimeListeners() {

  // ------------------------------------------
  // 1. LISTENER DATA SENSOR (/soil)
  // ------------------------------------------
  onValue(ref(rtdb, '/soil'), (snapshot) => {

    const data = snapshot.val();

    if (!data) {
      setDefaultValues();
      return;
    }

    const s1  = parseFloat(data.sensor1 || 0);
    const s2  = parseFloat(data.sensor2 || 0);
    const s3  = parseFloat(data.sensor3 || 0);
    const avg = parseFloat(data.average || 0);

    // Update tampilan sensor
    document.getElementById('sensor1Value').textContent = s1.toFixed(2) + '%';
    document.getElementById('sensor2Value').textContent = s2.toFixed(2) + '%';
    document.getElementById('sensor3Value').textContent = s3.toFixed(2) + '%';
    document.getElementById('averageValue').textContent = avg.toFixed(2) + '%';

    // Update alert kelembaban
    updateMoistureAlert(avg);

    // Simpan ke riwayat lokal
    moistureData.push({
      timestamp: new Date(),
      sensor1: s1,
      sensor2: s2,
      sensor3: s3,
      moisture: avg,
      pumpStatus: pumpStatus,
      mode: currentMode
    });

    if (moistureData.length > 200) moistureData.shift();

    updateChart();
    updateTable();

  }, (error) => {
    console.error('Sensor listener error:', error);
    setDefaultValues();
  });

  // ------------------------------------------
  // 2. LISTENER STATUS POMPA (/pump/status)
  // ------------------------------------------
  onValue(ref(rtdb, '/pump/status'), (snapshot) => {

    const val = snapshot.val();

    // Firebase kirim: 1 = ON, 0 = OFF
    pumpStatus = (val === 1 || val === '1') ? 'ON' : 'OFF';

    updatePumpDisplay();

  }, (error) => {
    console.error('Pump status listener error:', error);
  });

  // ------------------------------------------
  // 3. LISTENER MODE (/control/mode)
  // ------------------------------------------
  onValue(ref(rtdb, '/control/mode'), (snapshot) => {

    const val = snapshot.val() || 'auto';

    // ESP32 pakai 'auto'/'manual', web pakai 'otomatis'/'manual'
    currentMode = (val === 'auto') ? 'otomatis' : 'manual';

    updateModeDisplay();

  }, (error) => {
    console.error('Mode listener error:', error);
  });
}

// ===============================
// UPDATE PUMP DISPLAY
// ===============================
function updatePumpDisplay() {

  const statusDisplay = document.getElementById('pumpStatusDisplay');
  const indicator     = document.getElementById('pumpIndicator');

  if (!statusDisplay || !indicator) return;

  if (pumpStatus === 'ON') {
    statusDisplay.textContent = 'ON';
    statusDisplay.className   = 'status-value on';
    indicator.className       = 'status-indicator online';
    indicator.innerHTML       = '<div class="status-dot online"></div><span>Pompa Aktif</span>';
  } else {
    statusDisplay.textContent = 'OFF';
    statusDisplay.className   = 'status-value off';
    indicator.className       = 'status-indicator offline';
    indicator.innerHTML       = '<div class="status-dot offline"></div><span>Pompa Mati</span>';
  }
}

// ===============================
// UPDATE MODE DISPLAY
// ===============================
function updateModeDisplay() {

  const isManual = (currentMode === 'manual');
  const label    = isManual ? 'Manual' : 'Otomatis';

  // --- Kartu "Kontrol Mode" (admin only) ---
  const modeDisplay   = document.getElementById('modeDisplay');
  const modeIndicator = document.getElementById('modeIndicator');
  const modeDesc      = document.getElementById('modeDescription');
  const manualPanel   = document.getElementById('manualControlPanel');
  const autoBtn       = document.getElementById('autoModeBtn');
  const manualBtn     = document.getElementById('manualModeBtn');

  if (modeDisplay)   modeDisplay.textContent = label;

  if (modeIndicator) {
    modeIndicator.className = 'status-indicator ' + (isManual ? 'info' : 'online');
    modeIndicator.innerHTML = `<div class="status-dot ${isManual ? 'online' : 'online'}"></div>
      <span>Mode ${label} Aktif</span>`;
  }

  if (modeDesc) {
    if (isManual) {
      modeDesc.className = 'alert warning';
      modeDesc.innerHTML = '<span>⚠️</span><span><strong>Mode Manual:</strong> Sensor diabaikan, kontrol pompa manual</span>';
    } else {
      modeDesc.className = 'alert success';
      modeDesc.innerHTML = '<span>⚡</span><span><strong>Mode Otomatis:</strong> Pompa dikontrol otomatis oleh sensor</span>';
    }
  }

  if (manualPanel) manualPanel.style.display = isManual ? 'block' : 'none';

  // Highlight tombol aktif
  if (autoBtn) {
    autoBtn.classList.toggle('active', !isManual);
  }
  if (manualBtn) {
    manualBtn.classList.toggle('active', isManual);
  }

  // --- Kartu "Status Pompa" (read-only view) ---
  const modeRODisplay   = document.getElementById('modeDisplayReadOnly');
  const modeROIndicator = document.getElementById('modeIndicatorReadOnly');

  if (modeRODisplay)   modeRODisplay.textContent = label;

  if (modeROIndicator) {
    modeROIndicator.className = 'status-indicator ' + (isManual ? 'info' : 'online');
    modeROIndicator.innerHTML = `<div class="status-dot online"></div>
      <span>Mode ${label} Aktif</span>`;
  }
}

// ===============================
// UPDATE MOISTURE ALERT
// ===============================
function updateMoistureAlert(avg) {

  const alertDiv = document.getElementById('moistureAlert');
  if (!alertDiv) return;

  if (avg < THRESHOLD_KERING) {
    alertDiv.className = 'alert danger';
    alertDiv.innerHTML = '<span>⚠️</span><span><strong>KERING!</strong> Kelembaban rendah - pompa aktif otomatis</span>';
  } else if (avg > 70) {
    alertDiv.className = 'alert warning';
    alertDiv.innerHTML = '<span>💧</span><span><strong>Terlalu Basah!</strong> Periksa drainase</span>';
  } else {
    alertDiv.className = 'alert success';
    alertDiv.innerHTML = '<span>✅</span><span><strong>Normal</strong> - Kelembaban optimal</span>';
  }
}

// ===============================
// SET DEFAULT VALUES
// ===============================
function setDefaultValues() {
  ['sensor1Value','sensor2Value','sensor3Value','averageValue']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '0%';
    });

  const alertDiv = document.getElementById('moistureAlert');
  if (alertDiv) {
    alertDiv.className = 'alert info';
    alertDiv.innerHTML = '<span>ℹ️</span><span>Menunggu data sensor dari ESP32...</span>';
  }
}

// ===============================
// SET MODE (dipanggil dari tombol HTML)
// ===============================
window.setMode = async function(mode) {

  // Cek role admin
  if (getUserRole() !== 'admin') {
    alert('⚠️ Hanya Admin yang dapat mengubah mode!');
    return;
  }

  try {
    // Konversi: web pakai 'otomatis', ESP32 pakai 'auto'
    const rtdbMode = (mode === 'otomatis') ? 'auto' : 'manual';

    await set(ref(rtdb, '/control/mode'), rtdbMode);

    console.log('✅ Mode diubah ke:', rtdbMode);

    // Jika kembali ke otomatis, reset perintah pompa ke 0
    if (rtdbMode === 'auto') {
      await set(ref(rtdb, '/control/pump'), 0);
    }

  } catch (error) {
    console.error('setMode error:', error);
    alert('Gagal mengubah mode: ' + error.message);
  }
}

// ===============================
// CONTROL PUMP (dipanggil dari tombol HTML)
// ===============================
window.controlPump = async function(status) {

  // Harus dalam mode manual
  if (currentMode !== 'manual') {
    alert('⚠️ Ubah ke Mode Manual dulu sebelum kontrol pompa!');
    return;
  }

  // Cek role admin
  if (getUserRole() !== 'admin') {
    alert('⚠️ Hanya Admin yang dapat mengontrol pompa!');
    return;
  }

  try {
    // Kirim 1 = ON, 0 = OFF ke Firebase
    // ESP32 akan membaca ini dan menggerakkan relay
    const pumpValue = (status === 'ON') ? 1 : 0;

    await set(ref(rtdb, '/control/pump'), pumpValue);

    console.log('✅ Perintah pompa dikirim:', status, '(' + pumpValue + ')');

  } catch (error) {
    console.error('controlPump error:', error);
    alert('Gagal mengontrol pompa: ' + error.message);
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
          backgroundColor: 'rgba(0,123,255,0.08)',
          tension: 0.4,
          pointRadius: 3
        },
        {
          label: 'Sensor 2',
          data: [],
          borderColor: '#28a745',
          backgroundColor: 'rgba(40,167,69,0.08)',
          tension: 0.4,
          pointRadius: 3
        },
        {
          label: 'Sensor 3',
          data: [],
          borderColor: '#ffc107',
          backgroundColor: 'rgba(255,193,7,0.08)',
          tension: 0.4,
          pointRadius: 3
        },
        {
          label: 'Rata-rata',
          data: [],
          borderColor: '#dc3545',
          backgroundColor: 'rgba(220,53,69,0.1)',
          tension: 0.4,
          borderWidth: 3,
          pointRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: true, position: 'top' },
        tooltip: { mode: 'index', intersect: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          title: { display: true, text: 'Kelembaban (%)' }
        },
        x: {
          title: { display: true, text: 'Waktu' }
        }
      }
    }
  });
}

// ===============================
// UPDATE CHART
// ===============================
function updateChart() {

  if (!chart) return;

  const displayData = getDataByTimeRange();

  chart.data.labels             = displayData.map(d => formatTime(d.timestamp));
  chart.data.datasets[0].data  = displayData.map(d => d.sensor1);
  chart.data.datasets[1].data  = displayData.map(d => d.sensor2);
  chart.data.datasets[2].data  = displayData.map(d => d.sensor3);
  chart.data.datasets[3].data  = displayData.map(d => d.moisture);

  chart.update('none');
}

// ===============================
// GET DATA BY TIME RANGE
// ===============================
function getDataByTimeRange() {

  const now = Date.now();

  const ranges = {
    minute: 3600000,     // 1 jam
    hour:   86400000,    // 24 jam
    day:    2592000000,  // 30 hari
    week:   7776000000   // 90 hari
  };

  const limit = ranges[timeRange] || ranges.minute;

  return moistureData.filter(d => (now - d.timestamp.getTime()) < limit);
}

// ===============================
// CHANGE TIME RANGE (dari tombol HTML)
// ===============================
window.changeTimeRange = function(range) {

  timeRange = range;

  document.querySelectorAll('.time-btn').forEach(btn => btn.classList.remove('active'));

  // Tandai tombol aktif
  const btns = document.querySelectorAll('.time-btn');
  btns.forEach(btn => {
    if (btn.getAttribute('onclick')?.includes(range)) {
      btn.classList.add('active');
    }
  });

  // Update label info chart
  const labels = {
    minute: 'per menit (1 jam terakhir)',
    hour:   'per jam (24 jam terakhir)',
    day:    'per hari (30 hari terakhir)',
    week:   'per minggu (3 bulan terakhir)'
  };

  const infoEl = document.getElementById('chartInfoText');
  if (infoEl) infoEl.textContent = 'Menampilkan data ' + (labels[range] || '');

  updateChart();
}

// ===============================
// UPDATE TABLE
// ===============================
function updateTable() {

  const tbody = document.getElementById('tableBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (moistureData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#6c757d;">Belum ada data</td></tr>';
    return;
  }

  const recentData = [...moistureData].reverse().slice(0, 30);

  recentData.forEach(data => {

    const row = tbody.insertRow();

    row.insertCell(0).textContent = formatDateTime(data.timestamp);
    row.insertCell(1).textContent = data.sensor1.toFixed(2) + '%';
    row.insertCell(2).textContent = data.sensor2.toFixed(2) + '%';
    row.insertCell(3).textContent = data.sensor3.toFixed(2) + '%';
    row.insertCell(4).textContent = data.moisture.toFixed(2) + '%';

    const pumpCell = row.insertCell(5);
    pumpCell.textContent   = data.pumpStatus;
    pumpCell.style.fontWeight = 'bold';
    pumpCell.style.color   = data.pumpStatus === 'ON' ? '#28a745' : '#dc3545';

    row.insertCell(6).textContent = data.mode === 'otomatis' ? 'Otomatis' : 'Manual';
  });
}

// ===============================
// EXPORT TO EXCEL
// ===============================
window.exportToExcel = function() {

  if (getUserRole() !== 'admin') {
    alert('⚠️ Hanya Admin yang dapat export data!');
    return;
  }

  const ws_data = [['Waktu','Sensor 1 (%)','Sensor 2 (%)','Sensor 3 (%)','Rata-rata (%)','Status Pompa','Mode']];

  [...moistureData].reverse().slice(0, 100).forEach(d => {
    ws_data.push([
      formatDateTime(d.timestamp),
      d.sensor1, d.sensor2, d.sensor3, d.moisture,
      d.pumpStatus,
      d.mode === 'otomatis' ? 'Otomatis' : 'Manual'
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data Kelembaban');
  XLSX.writeFile(wb, 'data_kelembaban_' + new Date().toISOString().split('T')[0] + '.xlsx');
}

// ===============================
// LOGOUT
// ===============================
window.handleLogout = async function() {
  if (confirm('Yakin ingin logout?')) {
    try {
      await logout();
    } catch (error) {
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