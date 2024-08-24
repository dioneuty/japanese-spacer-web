let isEnabled = false;
let tokenizer = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'enableSpacing') {
    isEnabled = true;
    applySpacing();
  } else if (request.action === 'disableSpacing') {
    isEnabled = false;
    removeSpacing();
  }
});

function initializeKuromoji() {
  return new Promise((resolve, reject) => {
    console.log('Kuromoji 초기화 시작');
    const dicPath = chrome.runtime.getURL('lib/dict/');
    console.log('사전 경로:', dicPath);
    kuromoji.builder({ dicPath: dicPath }).build((err, _tokenizer) => {
      if (err) {
        console.error('kuromoji 초기화 실패:', err);
        console.error('오류 상세:', JSON.stringify(err));
        reject(err);
      } else {
        console.log('Kuromoji 초기화 성공');
        tokenizer = _tokenizer;
        resolve();
      }
    });
  });
}

function applySpacing() {
  if (!isEnabled || !tokenizer) return;
  processTextNodes(document.body);
}

function processTextNodes(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent;
    const tokens = tokenizer.tokenize(text);
    const spacedText = tokens.map(token => token.surface_form).join(' ');
    node.textContent = spacedText;
  } else {
    for (let child of node.childNodes) {
      processTextNodes(child);
    }
  }
}

function removeSpacing() {
  // 띄어쓰기 제거 로직 구현
  // 예: 모든 텍스트 노드에서 공백 제거
  processTextNodes(document.body, node => {
    node.textContent = node.textContent.replace(/\s+/g, '');
  });
}

// 초기 상태 확인 및 kuromoji 초기화
chrome.runtime.sendMessage({ action: 'getState' }, (response) => {
  isEnabled = response.enabled;
  initializeKuromoji().then(() => {
    if (isEnabled) {
      applySpacing();
    }
    // MutationObserver를 사용하여 동적 콘텐츠 처리
    const observer = new MutationObserver((mutations) => {
      if (isEnabled) {
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              processTextNodes(node);
            }
          });
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
});