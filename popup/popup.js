document.addEventListener('DOMContentLoaded', function() {
  const toggleSwitch = document.getElementById('toggleSwitch');
  const furiganaSwitch = document.getElementById('furiganaSwitch');
  const autoDisableSwitch = document.getElementById('autoDisableSwitch');
  const statusMessage = document.getElementById('statusMessage');
  const progressBar = document.getElementById('progressBar');

  // UI 업데이트 함수 추가
  function updateUI(data) {
    toggleSwitch.checked = data.enabled;
    furiganaSwitch.checked = data.furiganaEnabled;
    autoDisableSwitch.checked = data.autoDisable;
  }

  // 초기 상태 로드 시 updateUI 함수 사용
  chrome.storage.sync.get(['enabled', 'furiganaEnabled', 'autoDisable'], function(data) {
    updateUI(data);
  });

  // 메시지 리스너 추가
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updatePopupUI') {
      updateUI(request);
    }
  });

  // 각 스위치의 이벤트 리스너에서 상태 변경 시 storage 업데이트
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

  furiganaSwitch.addEventListener('change', function() {
    const isFuriganaEnabled = furiganaSwitch.checked;
    chrome.storage.sync.set({furiganaEnabled: isFuriganaEnabled}, function() {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'toggleFurigana',
          enabled: isFuriganaEnabled
        });
      });
    });
  });

  autoDisableSwitch.addEventListener('change', function() {
    const autoDisable = autoDisableSwitch.checked;
    chrome.storage.sync.set({autoDisable: autoDisable});
  });

  // 상태 메시지 및 프로그레스 바 업데이트 리스너
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

  // 팝업이 열릴 때마다 상태 확인 및 UI 업데이트
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {action: 'getState'}, function(response) {
      if (response) {
        updateUI(response);
      } else {
        loadAndUpdateUI();
      }
    });
  });
});