// fixed the logic when deleting or undoing the input
// Prevent multiple injections
if (!window.voiceInputInitialized) {
    window.voiceInputInitialized = true;
  
    console.log('Content script loaded');
  
    let recognition = null;
    let lastContent = '';
    let lastInterimResult = '';
    let userEditedContent = false;
  
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
                    
                    // Capture the initial content when starting recognition
                    const activeElement = document.activeElement;
                    if (activeElement && (activeElement.tagName === 'INPUT' || 
                        activeElement.tagName === 'TEXTAREA' || 
                        activeElement.isContentEditable)) {
                        lastContent = activeElement.isContentEditable ? 
                            activeElement.textContent : 
                            activeElement.value;
                    }
                    
                    lastInterimResult = '';
                    userEditedContent = false;
                    
                    // Add input event listener to detect user edits
                    document.addEventListener('input', handleUserInput);
                };
  
                recognition.onresult = (event) => {
                    const activeElement = document.activeElement;
                    if (!activeElement || !(activeElement.tagName === 'INPUT' || 
                        activeElement.tagName === 'TEXTAREA' || 
                        activeElement.isContentEditable)) {
                        return;
                    }
                    
                    // Get current content
                    const currentContent = activeElement.isContentEditable ? 
                        activeElement.textContent : 
                        activeElement.value;
                    
                    // Get the latest transcript
                    const results = event.results;
                    const latestResult = results[results.length - 1];
                    const transcript = latestResult[0].transcript.trim();
                    
                    // If user has edited the content, update our reference
                    if (userEditedContent) {
                        lastContent = currentContent;
                        userEditedContent = false;
                    }
                    
                    // If this is a new final result
                    if (latestResult.isFinal) {
                        // Add the new transcript to the content
                        const newContent = lastContent + ' ' + transcript;
                        
                        if (activeElement.isContentEditable) {
                            activeElement.textContent = newContent;
                        } else {
                            activeElement.value = newContent;
                        }
                        
                        // Update lastContent to include this final result
                        lastContent = newContent;
                        lastInterimResult = '';
                    } else {
                        // For interim results, temporarily show them
                        if (transcript !== lastInterimResult) {
                            const newContent = lastContent + ' ' + transcript;
                            
                            if (activeElement.isContentEditable) {
                                activeElement.textContent = newContent;
                            } else {
                                activeElement.value = newContent;
                            }
                            
                            lastInterimResult = transcript;
                        }
                    }
                };
  
                recognition.onerror = (event) => {
                    console.error('Voice recognition error:', event.error);
                };
  
                recognition.onend = () => {
                    console.log('Voice recognition ended');
                    showFloatingButton(false);
                    // Remove the input event listener when recognition ends
                    document.removeEventListener('input', handleUserInput);
                };
            }
  
            recognition.start();
        } catch (error) {
            console.error('Error initializing voice input:', error);
            throw error;
        }
    }
    
    function handleUserInput(event) {
        const target = event.target;
        if (target && (target.tagName === 'INPUT' || 
            target.tagName === 'TEXTAREA' || 
            target.isContentEditable)) {
            
            const currentContent = target.isContentEditable ? 
                target.textContent : 
                target.value;
            
            // Check if content has changed in a way that's not just appending
            // (which would be our own voice recognition updates)
            if (currentContent !== lastContent && 
                !currentContent.startsWith(lastContent)) {
                userEditedContent = true;
            }
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
