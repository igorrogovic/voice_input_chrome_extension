// Prevent multiple injections
if (!window.voiceInputInitialized) {
  window.voiceInputInitialized = true;

  console.log('Content script loaded');

  let recognition = null;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('Message received:', request);

      if (request.action === 'startVoiceInput') {
          try {
              initializeVoiceInput();
              sendResponse({ success: true });
          } catch (error) {
              console.error('Voice input error:', error);
              sendResponse({ success: false, error: error.message });
          }
          return true; // Keep message channel open
      }
  });

  function initializeVoiceInput() {
      try {
          if (!recognition) {
              recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
              recognition.continuous = true;
              recognition.interimResults = true;

              recognition.onstart = () => {
                  console.log('Voice recognition started');
                  showFloatingButton(true);
              };

              recognition.onresult = (event) => {
                  const activeElement = document.activeElement;
                  if (activeElement && (activeElement.tagName === 'INPUT' || 
                      activeElement.tagName === 'TEXTAREA' || 
                      activeElement.isContentEditable)) {
                      
                      const transcript = Array.from(event.results)
                          .map(result => result[0].transcript)
                          .join('');
                      
                      if (activeElement.isContentEditable) {
                          activeElement.textContent = transcript;
                      } else {
                          activeElement.value = transcript;
                      }
                  }
              };

              recognition.onerror = (event) => {
                  console.error('Voice recognition error:', event.error);
              };

              recognition.onend = () => {
                  console.log('Voice recognition ended');
                  showFloatingButton(false);
              };
          }

          recognition.start();
      } catch (error) {
          console.error('Error initializing voice input:', error);
          throw error;
      }
  }

  function showFloatingButton(show) {
      let floatingButton = document.getElementById('voice-input-button');
      
      if (!floatingButton && show) {
          floatingButton = document.createElement('button');
          floatingButton.id = 'voice-input-button';
          floatingButton.innerHTML = '🎤 Stop';
          floatingButton.style.cssText = `
              position: fixed;
              bottom: 20px;
              right: 20px;
              z-index: 10000;
              padding: 10px 20px;
              background: red;
              color: white;
              border: none;
              border-radius: 5px;
              cursor: pointer;
              font-family: Arial, sans-serif;
              box-shadow: 0 2px 5px rgba(0,0,0,0.2);
          `;
          
          floatingButton.addEventListener('click', () => {
              if (recognition) {
                  recognition.stop();
              }
              floatingButton.remove();
          });
          
          document.body.appendChild(floatingButton);
      } else if (floatingButton && !show) {
          floatingButton.remove();
      }
  }
}