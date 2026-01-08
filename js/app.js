// ===============================
// READ SENSOR DATA
// ===============================
database.ref('sensor').on('value', snapshot => {
  const data = snapshot.val();

  if (data) {
    document.getElementById('sensor1').innerText = data.sensor1 ?? '-';
    document.getElementById('sensor2').innerText = data.sensor2 ?? '-';
  }
});

// ===============================
// READ PUMP STATUS
// ===============================
database.ref('pump/status').on('value', snapshot => {
  const status = snapshot.val();
  document.getElementById('pumpStatus').innerText = status ?? '-';
});

// ===============================
// READ MODE
// ===============================
database.ref('mode').on('value', snapshot => {
  const mode = snapshot.val();
  document.getElementById('mode').innerText = mode ?? '-';
});

// ===============================
// CONTROL FUNCTIONS
// ===============================
function setPump(status) {
  database.ref('pump').set({
    status: status
  });
}

function setMode(mode) {
  database.ref('mode').set(mode);
}