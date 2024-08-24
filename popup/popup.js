document.addEventListener('DOMContentLoaded', function() {
    const toggleSwitch = document.getElementById('toggleSwitch');
    const statusText = document.getElementById('status');

    // 현재 상태 불러오기
    chrome.storage.sync.get('enabled', function(data) {
        toggleSwitch.checked = data.enabled;
        updateStatus(data.enabled);
    });

    // 토글 스위치 이벤트 리스너
    toggleSwitch.addEventListener('change', function() {
        const isEnabled = toggleSwitch.checked;
        chrome.storage.sync.set({enabled: isEnabled}, function() {
            updateStatus(isEnabled);
            // 현재 탭에 메시지 전송
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: isEnabled ? 'enableSpacing' : 'disableSpacing'
                });
            });
        });
    });

    function updateStatus(isEnabled) {
        statusText.textContent = isEnabled ? '활성화' : '비활성화';
        statusText.style.color = isEnabled ? '#2196F3' : '#333';
    }
});

function sendMessage(message) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, response => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(response);
            }
        });
    });
}

// 사용 예:
sendMessage({ action: 'getState' })
    .then(response => {
        console.log('Response:', response);
    })
    .catch(error => {
        console.error('Error:', error);
    });