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
        updateIcon(tab.id, true);
        chrome.tabs.sendMessage(tab.id, { action: 'enableSpacing' });
      } else {
        updateIcon(tab.id, false);
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
        // 페이지 로드 완료 시 content script에 메시지 전송
        chrome.tabs.sendMessage(tabId, { action: 'checkLanguage' });
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
  } else if (request.action === 'setEnabled') {
    chrome.storage.sync.set({ enabled: request.enabled }, () => {
      // 아이콘 상태 업데이트
      const iconPath = request.enabled ? 'icons/icon_active.png' : 'icons/icon_inactive.png';
      chrome.action.setIcon({ path: iconPath, tabId: sender.tab.id });
      sendResponse({ success: true });
    });
    return true;
  } else if (request.action === 'updateProgress') {
    chrome.runtime.sendMessage(request);
  }
});

function updateIcon(tabId, isActive) {
  const iconPath = isActive ? 'icons/icon_active.png' : 'icons/icon_inactive.png';
  chrome.action.setIcon({ path: iconPath, tabId: tabId });
}