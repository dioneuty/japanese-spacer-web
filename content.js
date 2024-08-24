// kuromoji 초기화
kuromoji.builder({ dicPath: chrome.runtime.getURL('lib/dict') }).build((err, tokenizer) => {
  if (err) {
    console.error('kuromoji 초기화 실패:', err);
    return;
  }

  // 페이지의 텍스트 노드를 찾아 처리
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

  // 페이지 전체 처리
  processTextNodes(document.body);
});
