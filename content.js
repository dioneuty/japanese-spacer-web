let isEnabled = false;
let tokenizer = null;
let processedNodes = new Set();
let totalNodes = 0;
let processedCount = 0;
let isFuriganaEnabled = false;
let originalTextMap = new WeakMap();

// 일본어 감지 함수
function detectJapanese(text) {
  const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF]/;
  return japaneseRegex.test(text);
}

// 한국어 스타일 띄어쓰기를 위한 함수
function shouldAddSpace(prevToken, token, nextToken) {
  const noSpacePos = ['助詞', '助動詞', '接続詞', '記号'];
  const contentPos = ['名詞', '動詞', '形容詞', '副詞', '連体詞'];

  // 조사, 조동사, 접속사, 기호 앞에는 붙여씀
  if (noSpacePos.includes(token.pos)) return false;

  // 내용어(명사, 동사, 형용사, 부사, 연체사) 앞에는 띄어씀
  if (contentPos.includes(token.pos) && prevToken && !noSpacePos.includes(prevToken.pos)) return true;

  // 문장 시작이거나 문장 부호 뒤에 오는 경우는 붙여씀
  if (!prevToken || prevToken.pos === '記号') return false;

  // 숫자와 단위는 붙여씀
  if (prevToken.pos === '名詞' && prevToken.pos_detail_1 === '数' && token.pos === '名詞' && token.pos_detail_1 === '一般') return false;

  // 복합어나 고유명사 처리 (예: 大阪府, 東京都)
  if (prevToken.pos === '名詞' && token.pos === '名詞' && token.pos_detail_1 === '接尾') return false;

  return true;
}

// kuromoji 초기화 함수
function initializeKuromoji() {
  return new Promise((resolve, reject) => {
    if (tokenizer) {
      resolve(tokenizer);
      return;
    }
    kuromoji.builder({ dicPath: chrome.runtime.getURL('lib/dict/') }).build((err, _tokenizer) => {
      if (err) {
        console.error('kuromoji 초기화 실패:', err);
        reject(err);
      } else {
        tokenizer = _tokenizer;
        resolve(tokenizer);
      }
    });
  });
}

// 후리가나 추가 함수
function addFurigana(node) {
  if (node.nodeType === Node.TEXT_NODE && detectJapanese(node.textContent)) {
    const text = node.textContent;
    const tokens = tokenizer.tokenize(text);
    const fragment = document.createDocumentFragment();

    tokens.forEach(token => {
      if (token.reading !== token.surface_form && /[\u4e00-\u9faf]/.test(token.surface_form)) {
        const ruby = document.createElement('ruby');
        const rb = document.createElement('rb');
        rb.textContent = token.surface_form;
        ruby.appendChild(rb);
        const rt = document.createElement('rt');
        rt.textContent = token.reading;
        ruby.appendChild(rt);
        fragment.appendChild(ruby);
      } else {
        fragment.appendChild(document.createTextNode(token.surface_form));
      }
    });

    node.parentNode.replaceChild(fragment, node);
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    Array.from(node.childNodes).forEach(addFurigana);
  }
}

// 후리가나 제거 함수
function removeFurigana(node) {
  if (node.nodeType === Node.ELEMENT_NODE) {
    if (node.tagName.toLowerCase() === 'ruby') {
      const text = node.textContent.replace(/\s+/g, '');
      node.parentNode.replaceChild(document.createTextNode(text), node);
    } else {
      Array.from(node.childNodes).forEach(removeFurigana);
    }
  }
}

// 텍스트 노드 처리 함수 개선
async function processTextNodes(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    if (!processedNodes.has(node) && detectJapanese(node.textContent)) {
      try {
        // tokenizer가 초기화되지 않았다면 초기화
        if (!tokenizer) {
          await initializeKuromoji();
        }
        
        const originalText = node.textContent;
        originalTextMap.set(node, originalText);  // 원본 텍스트 저장

        const text = node.textContent;
        const tokens = tokenizer.tokenize(text);
        let spacedText = '';
        let prevToken = null;

        for (let i = 0; i < tokens.length; i++) {
          const token = tokens[i];
          const nextToken = i < tokens.length - 1 ? tokens[i + 1] : null;
          
          if (i > 0 && shouldAddSpace(prevToken, token, nextToken)) {
            spacedText += ' ';
          }
          spacedText += token.surface_form;
          prevToken = token;
        }

        // 문장 부호 주변 띄어쓰기 처리
        spacedText = spacedText.replace(/ ([、。！？])/g, '$1');
        spacedText = spacedText.replace(/([「『（）])/g, '$1');

        node.textContent = spacedText;
        processedNodes.add(node);

        if (isFuriganaEnabled) {
          addFurigana(node);
        }
      } catch (error) {
        console.error('텍스트 처리 중 오류 발생:', error);
      }
    }
    processedCount++;
    if (processedCount % 100 === 0) {
      const percentage = (processedCount / totalNodes * 100).toFixed(2);
      updateProgress(`처리 중: ${percentage}%`, parseFloat(percentage));
    }
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    for (let child of node.childNodes) {
      await processTextNodes(child);
    }
  }
}

// 진행도 표시 함수
function updateProgress(message, percentage) {
    chrome.runtime.sendMessage({
      action: 'updateProgress',
      message: message,
      percentage: percentage
    });
  }

// 띄어쓰기 제거 함수
function removeSpacingAndFurigana() {
  processedNodes.forEach(node => {
    if (originalTextMap.has(node)) {
      node.textContent = originalTextMap.get(node);  // 원본 텍스트로 복원
    }
  });
  originalTextMap = new WeakMap();
  processedNodes.clear();
  removeFurigana(document.body);
}

// 페이지 언어 확인 및 상태 설정
function checkLanguageAndSetState() {
  chrome.storage.sync.get(['enabled', 'furiganaEnabled'], (data) => {
    isEnabled = data.enabled;
    isFuriganaEnabled = data.furiganaEnabled;
    if (isEnabled && detectJapanese(document.body.innerText)) {
      updateProgress('일본어 감지됨, kuromoji 초기화 시작');
      initializeKuromoji().then(() => {
        updateProgress('kuromoji 초기화 완료, 처리 시작');
        processTextNodes(document.body);
      });
    } else {
      updateProgress('띄어쓰기 및 후리가나 제거');
      removeSpacingAndFurigana();
    }
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateState') {
    isEnabled = request.enabled;
    isFuriganaEnabled = request.furiganaEnabled;
    
    if (!isEnabled) {
      removeSpacingAndFurigana();
    } else if (detectJapanese(document.body.innerText)) {
      processTextNodes(document.body);
    }
    
    // 팝업 UI 업데이트를 위해 메시지 전송
    chrome.runtime.sendMessage({
      action: 'updatePopupUI',
      enabled: isEnabled,
      furiganaEnabled: isFuriganaEnabled
    });
  }
  if (request.action === 'checkLanguage') {
    checkLanguageAndSetState();
  } else if (request.action === 'enableSpacing') {
    isEnabled = true;
    checkLanguageAndSetState();
  } else if (request.action === 'disableSpacing') {
    isEnabled = false;
    removeSpacingAndFurigana();
  } else if (request.action === 'toggleFurigana') {
    isFuriganaEnabled = request.enabled;
    if (isEnabled) {
      if (isFuriganaEnabled) {
        processTextNodes(document.body);
      } else {
        removeFurigana(document.body);
      }
    }
  } else if (request.action === 'pageChanged') {
    chrome.storage.sync.get(['autoDisable', 'enabled', 'furiganaEnabled'], (data) => {
      if (data.autoDisable && (data.enabled || data.furiganaEnabled)) {
        isEnabled = false;
        isFuriganaEnabled = false;
        removeSpacingAndFurigana();
        chrome.storage.sync.set({enabled: false, furiganaEnabled: false});
        // 팝업 UI 업데이트를 위해 메시지 전송
        chrome.runtime.sendMessage({
          action: 'updatePopupUI', 
          enabled: false, 
          furiganaEnabled: false
        });
      }
    });
  }
});

// MutationObserver 설정
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

// MutationObserver 시작
observer.observe(document.body, { childList: true, subtree: true });

// 초기 상태 확인 및 설정
chrome.storage.sync.get(['enabled', 'furiganaEnabled'], (data) => {
  isEnabled = data.enabled;
  isFuriganaEnabled = data.furiganaEnabled;
  if (isEnabled) {
    checkLanguageAndSetState();
  }
});

// 초기 상태 요청
chrome.runtime.sendMessage({action: 'getInitialState'});