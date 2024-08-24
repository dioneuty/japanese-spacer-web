// 확장 프로그램 설치 또는 업데이트 시 실행되는 이벤트 리스너
chrome.runtime.onInstalled.addListener(() => {
  // 초기 설정 저장
  chrome.storage.sync.set({ enabled: false }, () => {
    console.log('일본어 띄어쓰기 플러그인이 비활성화 상태로 설치되었습니다.');
  });
});

// 브라우저 액션(아이콘) 클릭 시 실행되는 이벤트 리스너
chrome.action.onClicked.addListener((tab) => {
  chrome.storage.sync.get('enabled', (data) => {
    const newState = !data.enabled;
    chrome.storage.sync.set({ enabled: newState }, () => {
      if (newState) {
        chrome.action.setIcon({ path: 'icons/icon_active.png' });
        chrome.tabs.sendMessage(tab.id, { action: 'enableSpacing' });
      } else {
        chrome.action.setIcon({ path: 'icons/icon_inactive.png' });
        chrome.tabs.sendMessage(tab.id, { action: 'disableSpacing' });
      }
    });
  });
});

// 탭 업데이트 시 실행되는 이벤트 리스너
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    chrome.storage.sync.get('enabled', (data) => {
      if (data.enabled) {
        chrome.tabs.sendMessage(tabId, { action: 'enableSpacing' });
      }
    });
  }
});

// content script로부터의 메시지 처리
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getState') {
    chrome.storage.sync.get('enabled', (data) => {
      sendResponse({ enabled: data.enabled });
    });
    return true; // 비동기 응답을 위해 true 반환
  }
});
