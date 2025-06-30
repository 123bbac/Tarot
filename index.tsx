
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {GoogleGenAI, GenerateContentResponse, Chat} from '@google/genai';

interface TarotCard {
  name: string;
  id: string; // Unique ID for each card instance if needed for DOM
  description?: string; 
  position?: string; // For spreads: "過去", "現在", "未來"
  isRevealed?: boolean;
  element?: HTMLDivElement; // Reference to its DOM element when displayed
}

const getInterpretationButton = document.getElementById(
  'getInterpretationButton',
) as HTMLButtonElement;
const cardSelectionArea = document.getElementById(
  'cardSelectionArea',
) as HTMLDivElement;
const selectedCardsDisplayArea = document.getElementById(
  'selectedCardsDisplayArea',
) as HTMLDivElement;
const interpretationDisplayArea = document.getElementById(
  'interpretationDisplayArea',
) as HTMLDivElement;
const loadingMessage = document.getElementById('loadingMessage') as HTMLDivElement;
const gameplaySelect = document.getElementById('gameplaySelect') as HTMLSelectElement;
const instructionText = document.getElementById('instructionText') as HTMLParagraphElement;

const chatInterface = document.getElementById('chatInterface') as HTMLDivElement;
const chatHistoryArea = document.getElementById('chatHistoryArea') as HTMLDivElement;
const chatInput = document.getElementById('chatInput') as HTMLInputElement;
const sendChatMessageButton = document.getElementById('sendChatMessageButton') as HTMLButtonElement;

const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
let chat: Chat | null = null;
let initialInterpretationFullText = ''; // Store initial interpretation for chat context

const majorArcanaDeck: Omit<TarotCard, 'id' | 'element' | 'isRevealed' | 'position'>[] = [
  {name: '愚者'}, {name: '魔術師'}, {name: '女祭司'}, {name: '皇后'}, {name: '皇帝'},
  {name: '教皇'}, {name: '戀人'}, {name: '戰車'}, {name: '力量'}, {name: '隱士'},
  {name: '命運之輪'}, {name: '正義'}, {name: '倒吊人'}, {name: '死神'}, {name: '節制'},
  {name: '惡魔'}, {name: '塔'}, {name: '星星'}, {name: '月亮'}, {name: '太陽'},
  {name: '審判'}, {name: '世界'},
];

let selectableCards: TarotCard[] = [];
let selectedCardsForSpread: TarotCard[] = [];
let maxCardsToSelect = 1;
let cardsSelectedCount = 0;

function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

function initializeCardSelection() {
  cardsSelectedCount = 0;
  selectedCardsForSpread = [];
  cardSelectionArea.innerHTML = '';
  selectedCardsDisplayArea.innerHTML = ''; // Clear previously selected cards display
  interpretationDisplayArea.innerHTML = '';
  chatInterface.style.display = 'none';
  chatHistoryArea.innerHTML = '';
  loadingMessage.textContent = '';
  getInterpretationButton.disabled = true;
  getInterpretationButton.textContent = '開始占卜';
  gameplaySelect.disabled = false;
  chat = null; // Reset chat session

  const selectedGameplay = gameplaySelect.value;
  if (selectedGameplay === 'single') {
    maxCardsToSelect = 1;
    instructionText.textContent = '請從下方牌堆中選擇 1 張塔羅牌。';
  } else if (selectedGameplay === 'threeCard') {
    maxCardsToSelect = 3;
    instructionText.textContent = '請從下方牌堆中選擇 3 張塔羅牌 (依序代表過去、現在、未來)。';
  }

  displayFaceDownCards();
}

function displayFaceDownCards() {
  selectableCards = shuffleArray(majorArcanaDeck).map((card, index) => ({
    ...card,
    id: `card-${index}-${Date.now()}`,
    isRevealed: false,
  }));

  selectableCards.forEach(card => {
    const cardDiv = document.createElement('div');
    cardDiv.classList.add('tarot-card', 'face-down');
    cardDiv.setAttribute('aria-label', '未翻開的塔羅牌');
    cardDiv.dataset.cardId = card.id;
    // Add card back design or text
    const cardBack = document.createElement('div');
    cardBack.classList.add('tarot-card-back');
    cardBack.textContent = '選我'; 
    cardDiv.appendChild(cardBack);

    card.element = cardDiv; // Store reference to the DOM element

    cardDiv.addEventListener('click', () => handleCardClick(card));
    cardSelectionArea.appendChild(cardDiv);
  });
}

function handleCardClick(clickedCard: TarotCard) {
  if (cardsSelectedCount >= maxCardsToSelect || clickedCard.isRevealed) {
    return; // Already selected enough cards or this card is already chosen
  }

  clickedCard.isRevealed = true;
  cardsSelectedCount++;
  
  // Update the card's appearance to "revealed"
  const cardDiv = clickedCard.element;
  if (!cardDiv) return;

  cardDiv.classList.remove('face-down');
  cardDiv.classList.add('revealed'); 
  cardDiv.innerHTML = ''; // Clear card back

  const cardNameDiv = document.createElement('div');
  cardNameDiv.classList.add('tarot-card-name');
  cardNameDiv.textContent = clickedCard.name;

  const cardImagePlaceholder = document.createElement('div');
  cardImagePlaceholder.classList.add('tarot-card-image-placeholder');
  
  cardDiv.appendChild(cardNameDiv);
  cardDiv.appendChild(cardImagePlaceholder);
  
  let positionName = '';
  if (gameplaySelect.value === 'threeCard') {
    if (cardsSelectedCount === 1) positionName = '過去';
    else if (cardsSelectedCount === 2) positionName = '現在';
    else if (cardsSelectedCount === 3) positionName = '未來';
    clickedCard.position = positionName;
  }
  
  selectedCardsForSpread.push(clickedCard);
  
  // Add position label if applicable
  if (clickedCard.position) {
    const positionLabel = document.createElement('div');
    positionLabel.classList.add('tarot-card-position-label', 'inline-position');
    positionLabel.textContent = clickedCard.position;
    cardDiv.appendChild(positionLabel); // Append position to the card itself
    cardDiv.setAttribute('aria-label', `塔羅牌：${clickedCard.name}，位置：${clickedCard.position}`);
  } else {
    cardDiv.setAttribute('aria-label', `塔羅牌：${clickedCard.name}`);
  }
  
  // Update instructions
  if (cardsSelectedCount < maxCardsToSelect) {
    const remaining = maxCardsToSelect - cardsSelectedCount;
    instructionText.textContent = `請再選擇 ${remaining} 張牌。`;
  } else {
    instructionText.textContent = '已選擇完畢！請點擊「獲取解讀」按鈕。';
    getInterpretationButton.disabled = false;
    getInterpretationButton.textContent = '獲取解讀';
    // Disable further clicks on remaining face-down cards
    document.querySelectorAll('.tarot-card.face-down').forEach(el => {
        (el as HTMLDivElement).style.pointerEvents = 'none';
        (el as HTMLDivElement).style.opacity = '0.5';
    });
  }
}


getInterpretationButton.addEventListener('click', async () => {
  if (selectedCardsForSpread.length !== maxCardsToSelect) {
    loadingMessage.textContent = '請先依照指示選擇足夠的卡牌。';
    return;
  }

  loadingMessage.textContent = '正在解讀您選擇的牌義...';
  interpretationDisplayArea.innerHTML = ''; // Clear previous interpretation
  getInterpretationButton.disabled = true;
  gameplaySelect.disabled = true;
  cardSelectionArea.style.display = 'none'; // Hide selection area

  // Move selected cards to the display area for focus
  selectedCardsDisplayArea.innerHTML = ''; // Clear it first
  const cardContainer = document.createElement('div');
  cardContainer.classList.add('tarot-cards-layout-area');
  if (selectedCardsForSpread.length > 1) {
    cardContainer.classList.add('multiple-cards');
  }

  selectedCardsForSpread.forEach(card => {
    const cardWrapper = document.createElement('div');
    cardWrapper.classList.add('tarot-card-wrapper');

    if (card.position) {
      const positionLabel = document.createElement('div');
      positionLabel.classList.add('tarot-card-position-label');
      positionLabel.textContent = card.position;
      cardWrapper.appendChild(positionLabel);
    }

    const clonedCardDiv = card.element!.cloneNode(true) as HTMLDivElement;
    clonedCardDiv.classList.remove('face-down'); // Ensure it's revealed
    clonedCardDiv.style.pointerEvents = 'auto'; // Re-enable pointer events if needed
    clonedCardDiv.style.opacity = '1';
    
    // Remove inline position if it was added, rely on wrapper's position label
    const inlinePos = clonedCardDiv.querySelector('.inline-position');
    if(inlinePos) inlinePos.remove();

    cardWrapper.appendChild(clonedCardDiv);
    cardContainer.appendChild(cardWrapper);
  });
  selectedCardsDisplayArea.appendChild(cardContainer);


  try {
    let prompt = '';
    const cardNames = selectedCardsForSpread.map(c => c.name).join('、');

    if (gameplaySelect.value === 'single') {
      prompt = `請用中文詳細解釋塔羅牌「${selectedCardsForSpread[0].name}」的牌義，包括它在愛情、事業和整體運勢方面的指引。請提供豐富且具有洞察力的解讀。`;
    } else if (gameplaySelect.value === 'threeCard') {
      const pastCard = selectedCardsForSpread.find(c => c.position === '過去')?.name;
      const presentCard = selectedCardsForSpread.find(c => c.position === '現在')?.name;
      const futureCard = selectedCardsForSpread.find(c => c.position === '未來')?.name;
      prompt = `我正在進行一個三張牌的塔羅占卜。
      第一張牌代表「過去」，抽到的是「${pastCard}」。
      第二張牌代表「現在」，抽到的是「${presentCard}」。
      第三張牌代表「未來」，抽到的是「${futureCard}」。
      請結合這三張牌的牌義以及它們在「過去」、「現在」、「未來」位置上的意義，提供一個連貫且深入的中文解讀，分析整體情況的發展趨勢，並給出指引。請將解讀分為過去、現在、未來和綜合建議幾個部分，使其條理清晰。`;
    }

    if (prompt) {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-04-17',
        contents: prompt,
      });

      initialInterpretationFullText = response.text; // Store for chat context

      if (initialInterpretationFullText) {
        interpretationDisplayArea.innerHTML = formatInterpretationText(initialInterpretationFullText);
        loadingMessage.textContent = ''; 
        initializeChat(); // Setup chat after interpretation
      } else {
        interpretationDisplayArea.innerHTML = '<p class="error-text">無法獲取牌義的詳細解讀。</p>';
        loadingMessage.textContent = '解讀部分失敗，請稍後再試。';
      }
    } else {
        throw new Error("無效的牌陣選擇或未能準備好提示詞。");
    }

  } catch (error: unknown) {
    console.error('解讀塔羅牌時出錯:', error);
    const detailedError = (error as Error)?.message || '發生未知錯誤';
    loadingMessage.textContent = `錯誤：${detailedError}`;
    interpretationDisplayArea.innerHTML = `<p class="error-text">無法載入塔羅牌解讀，請檢查網路連線或稍後再試。</p>`;
  } finally {
    // Button state managed by selection flow, keep it disabled until new selection starts.
    // gameplaySelect also remains disabled until a new game starts.
  }
});

function formatInterpretationText(text: string): string {
  let formattedText = text.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>');
  const keywords = ['愛情', '事業', '學業', '財運', '健康', '整體運勢', '建議', '提醒', '過去', '現在', '未來', '總結', '綜合建議'];
  keywords.forEach(keyword => {
    const regex = new RegExp(`(${keyword}\\s*[:：]?)`, 'gi');
    formattedText = formattedText.replace(regex, '<strong>$1</strong>');
  });
  return `<p>${formattedText}</p>`;
}

function initializeChat() {
  const spreadType = gameplaySelect.options[gameplaySelect.selectedIndex].text;
  const cardDetailsParts: string[] = selectedCardsForSpread.map(card => {
    return `${card.name}${card.position ? ` (${card.position})` : ''}`;
  });
  const cardDetailsString = cardDetailsParts.join(', ');

  const systemInstruction = `你是一位知識淵博的塔羅牌解讀師。使用者剛剛透過一個「${spreadType}」牌陣進行了占卜。抽到的牌及其對應位置（如果適用）如下： ${cardDetailsString}。 你提供的初步解讀是： “${initialInterpretationFullText}”。現在，請針對使用者關於此次占卜的任何追問，提供進一步的澄清、深入分析或相關建議。請保持解讀風格一致，並專注於已抽出的牌和它們的意義。回答時請使用中文。`;
  
  try {
    chat = ai.chats.create({
      model: 'gemini-2.5-flash-preview-04-17',
      config: { systemInstruction: systemInstruction },
      history: [ // Prime the chat with the initial interaction
        { role: 'user', parts: [{ text: `我抽到的牌是 ${cardDetailsString}，請解讀。` }] },
        { role: 'model', parts: [{ text: initialInterpretationFullText }] }
      ]
    });
    chatInterface.style.display = 'block';
    chatInput.value = '';
    chatInput.focus();
  } catch (error) {
    console.error("初始化聊天功能失敗:", error);
    appendMessageToChatHistory("聊天功能初始化失敗，請稍後再試。", "error");
  }
}

async function handleSendMessage() {
  if (!chat || chatInput.value.trim() === '') return;

  const userMessage = chatInput.value.trim();
  appendMessageToChatHistory(userMessage, 'user');
  chatInput.value = '';
  sendChatMessageButton.disabled = true;
  loadingMessage.textContent = 'AI 正在思考...';

  try {
    const stream = await chat.sendMessageStream({message: userMessage});
    let aiResponseText = '';
    // Create a new div for the AI's response to stream into
    const aiMessageDiv = document.createElement('div');
    aiMessageDiv.classList.add('chat-message', 'ai-message');
    chatHistoryArea.appendChild(aiMessageDiv);
    chatHistoryArea.scrollTop = chatHistoryArea.scrollHeight; // Scroll to new message

    for await (const chunk of stream) {
      aiResponseText += chunk.text;
      aiMessageDiv.innerHTML = formatInterpretationText(aiResponseText); // Use same formatting
      chatHistoryArea.scrollTop = chatHistoryArea.scrollHeight;
    }
     // After streaming is complete, ensure the full message is stored if needed for history reconstruction
    // The Gemini SDK's `chat.history` should be automatically updated.

  } catch (error: unknown) {
    console.error('發送聊天訊息時出錯:', error);
    const detailedError = (error as Error)?.message || '未知聊天錯誤';
    appendMessageToChatHistory(`訊息傳送失敗: ${detailedError}`, 'error');
  } finally {
    sendChatMessageButton.disabled = false;
    loadingMessage.textContent = '';
    chatInput.focus();
  }
}

function appendMessageToChatHistory(message: string, sender: 'user' | 'ai' | 'error') {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('chat-message', `${sender}-message`);
  messageDiv.innerHTML = formatInterpretationText(message); // Use common formatter
  chatHistoryArea.appendChild(messageDiv);
  chatHistoryArea.scrollTop = chatHistoryArea.scrollHeight;
}

// Event Listeners
gameplaySelect.addEventListener('change', initializeCardSelection);
sendChatMessageButton.addEventListener('click', handleSendMessage);
chatInput.addEventListener('keypress', (event) => {
  if (event.key === 'Enter') {
    handleSendMessage();
  }
});

// Initial setup
initializeCardSelection();
