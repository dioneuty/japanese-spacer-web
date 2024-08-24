let isEnabled = false;
let tokenizer = null;
let processedNodes = new WeakSet();
let totalNodes = 0;
let processedCount = 0;

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

// 텍스트 노드 처리 함수 개선
async function processTextNodes(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    if (!processedNodes.has(node) && detectJapanese(node.textContent)) {
      try {
        // tokenizer가 초기화되지 않았다면 초기화
        if (!tokenizer) {
          await initializeKuromoji();
        }
        
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
        spacedText = spacedText.replace(/ ([、。！？」』）])/g, '$1');
        spacedText = spacedText.replace(/([「『（]) /g, '$1');

        node.textContent = spacedText;
        processedNodes.add(node);
      } catch (error) {
        console.error('텍스트 처리 중 오류 발생:', error);
      }
    }
    processedCount++;
    if (processedCount % 100 === 0) {
      const percentage = (processedCount / totalNodes * 100).toFixed(2);
      updateProgress(`처리 중: ${percentage}%`, parseFloat(percentage));
    }
  } else {
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
function removeSpacing() {
  processTextNodes(document.body, (node) => {
    if (processedNodes.has(node)) {
      node.textContent = node.textContent.replace(/\s+/g, '');
      processedNodes.delete(node);
    }
  });
}

// 페이지 언어 확인 및 상태 설정
function checkLanguageAndSetState() {
  chrome.storage.sync.get('enabled', (data) => {
    isEnabled = data.enabled;
    if (isEnabled && detectJapanese(document.body.innerText)) {
      updateProgress('일본어 감지됨, kuromoji 초기화 시작');
      initializeKuromoji().then(() => {
        updateProgress('kuromoji 초기화 완료, 띄어쓰기 적용 시작');
        processTextNodes(document.body);  // applySpacing() 대신 processTextNodes() 호출
      });
    } else {
      updateProgress('띄어쓰기 제거');
      removeSpacing();
    }
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkLanguage') {
    checkLanguageAndSetState();
  } else if (request.action === 'enableSpacing') {
    isEnabled = true;
    checkLanguageAndSetState();
  } else if (request.action === 'disableSpacing') {
    isEnabled = false;
    removeSpacing();
  }
});

// 초기 상태 확인 및 kuromoji 초기화
chrome.storage.sync.get('enabled', (data) => {
  isEnabled = data.enabled;
  if (isEnabled) {
    checkLanguageAndSetState();
  }
});

// MutationObserver 설정
const observer = new MutationObserver((mutations) => {
  if (isEnabled) {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE && detectJapanese(node.innerText)) {
          processTextNodes(node);
        }
      });
    });
  }
});

// MutationObserver 시작
observer.observe(document.body, { childList: true, subtree: true });

// 메인 함수
async function main() {
  try {
    await initializeKuromoji();
    processTextNodes(document.body);
  } catch (error) {
    console.error('초기화 중 오류 발생:', error);
  }
}

// 실행
main();