document.addEventListener('DOMContentLoaded', function() {
    const toggleSwitch = document.getElementById('toggleSwitch');
    const statusMessage = document.getElementById('statusMessage');
    const progressBar = document.getElementById('progressBar');
  
    // 초기 상태 설정
    chrome.storage.sync.get('enabled', function(data) {
      toggleSwitch.checked = data.enabled;
    });
  
    // 토글 스위치 이벤트 리스너
    toggleSwitch.addEventListener('change', function() {
      const isEnabled = toggleSwitch.checked;
      chrome.storage.sync.set({enabled: isEnabled}, function() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: isEnabled ? 'enableSpacing' : 'disableSpacing'
          });
        });
      });
    });
  
    // 진행 상황 업데이트 리스너
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'updateProgress') {
        statusMessage.textContent = request.message;
        if (request.percentage !== null) {
          progressBar.style.width = `${request.percentage}%`;
          progressBar.textContent = `${request.percentage}%`;
        } else {
          progressBar.style.width = '0%';
          progressBar.textContent = '';
        }
      }
    });
  });