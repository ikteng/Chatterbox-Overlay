// ---- NG word/user import & export ----
const fileImportInput = document.getElementById('file-import');
const filterTextareas = { ngwords: document.getElementById('opt-ngwords'), ngusers: document.getElementById('opt-ngusers') };
let importTarget = '';

document.querySelectorAll('.btn-import').forEach(btn => {
  btn.addEventListener('click', () => {
    importTarget = btn.dataset.target;
    fileImportInput.click();
  });
});

fileImportInput.addEventListener('change', () => {
  const file = fileImportInput.files[0];
  const textarea = filterTextareas[importTarget];
  if (!file || !textarea) return;
  const reader = new FileReader();
  reader.onload = () => {
    const existing = textarea.value.split('\n').map(s => s.trim()).filter(Boolean);
    const imported = String(reader.result).split('\n').map(s => s.trim()).filter(Boolean);
    const merged = Array.from(new Set([...existing, ...imported]));
    textarea.value = merged.join('\n');
  };
  reader.readAsText(file);
  fileImportInput.value = '';
});

document.querySelectorAll('.btn-export').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.target;
    const textarea = filterTextareas[target];
    if (!textarea) return;
    const blob = new Blob([textarea.value], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${target}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
});
