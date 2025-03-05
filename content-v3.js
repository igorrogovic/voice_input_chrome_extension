// improved casing
// Prevent multiple injections
if (!window.voiceInputInitialized) {
    window.voiceInputInitialized = true;
  
    console.log('Content script loaded');
  
    let recognition = null;
    let lastContent = '';
    let lastInterimResult = '';
    let userEditedContent = false;
    let cursorPositionBeforeInterim = 0;
  
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
                        cursorPositionBeforeInterim = getCursorPosition(activeElement);
                    }
                    
                    lastInterimResult = '';
                    userEditedContent = false;
                    
                    // Add input event listener to detect user edits
                    document.addEventListener('input', handleUserInput);
                    // Add keydown listener to detect Enter key
                    document.addEventListener('keydown', handleKeyDown);
                };
  
                recognition.onresult = (event) => {
                    const activeElement = document.activeElement;
                    if (!activeElement || !(activeElement.tagName === 'INPUT' || 
                        activeElement.tagName === 'TEXTAREA' || 
                        activeElement.isContentEditable)) {
                        return;
                    }
                    
                    // Get the latest transcript
                    const results = event.results;
                    const latestResult = results[results.length - 1];
                    let transcript = latestResult[0].transcript.trim();
                    
                    // Fix casing
                    transcript = fixCasing(transcript);
                    
                    // If user has edited the content, update our reference
                    if (userEditedContent) {
                        lastContent = activeElement.isContentEditable ? 
                            activeElement.textContent : 
                            activeElement.value;
                        cursorPositionBeforeInterim = getCursorPosition(activeElement);
                        userEditedContent = false;
                    }
                    
                    // If this is a new final result
                    if (latestResult.isFinal) {
                        // Remove any interim results first
                        let currentContent = lastContent;
                        
                        // Insert the new transcript at cursor position
                        const newContent = insertAtCursor(currentContent, transcript, cursorPositionBeforeInterim);
                        
                        if (activeElement.isContentEditable) {
                            activeElement.textContent = newContent;
                        } else {
                            activeElement.value = newContent;
                        }
                        
                        // Update cursor position
                        const newCursorPosition = cursorPositionBeforeInterim + transcript.length + 
                            (shouldAddSpace(currentContent, cursorPositionBeforeInterim) ? 1 : 0);
                        setCursorPosition(activeElement, newCursorPosition);
                        
                        // Update lastContent to include this final result
                        lastContent = newContent;
                        cursorPositionBeforeInterim = newCursorPosition;
                        lastInterimResult = '';
                    } else {
                        // For interim results, temporarily show them
                        // First, restore content without interim results
                        let contentToShow = lastContent;
                        
                        // Then add the new interim result
                        contentToShow = insertAtCursor(contentToShow, transcript, cursorPositionBeforeInterim);
                        
                        if (activeElement.isContentEditable) {
                            activeElement.textContent = contentToShow;
                        } else {
                            activeElement.value = contentToShow;
                        }
                        
                        // Set cursor at the end of the interim result
                        const interimEndPosition = cursorPositionBeforeInterim + transcript.length + 
                            (shouldAddSpace(lastContent, cursorPositionBeforeInterim) ? 1 : 0);
                        setCursorPosition(activeElement, interimEndPosition);
                        
                        lastInterimResult = transcript;
                    }
                };
  
                recognition.onerror = (event) => {
                    console.error('Voice recognition error:', event.error);
                };
  
                recognition.onend = () => {
                    console.log('Voice recognition ended');
                    showFloatingButton(false);
                    // Remove the event listeners when recognition ends
                    document.removeEventListener('input', handleUserInput);
                    document.removeEventListener('keydown', handleKeyDown);
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
            
            // Check if content has changed
            if (currentContent !== lastContent) {
                userEditedContent = true;
            }
        }
    }
    
    function handleKeyDown(event) {
        // Check if Enter key was pressed
        if (event.key === 'Enter') {
            const target = event.target;
            if (target && (target.tagName === 'TEXTAREA' || target.isContentEditable)) {
                // Wait a short moment for the new line to be added
                setTimeout(() => {
                    const currentContent = target.isContentEditable ? 
                        target.textContent : 
                        target.value;
                    
                    // Update lastContent and cursor position
                    lastContent = currentContent;
                    cursorPositionBeforeInterim = getCursorPosition(target);
                    userEditedContent = false;
                }, 10);
            }
        }
    }
    
    // Helper function to determine if we need to add a space
    function shouldAddSpace(text, position) {
        if (position <= 0) return false;
        
        const charBefore = text.charAt(position - 1);
        // Don't add space after newlines, spaces, or at the beginning
        return charBefore !== '\n' && charBefore !== '\r' && charBefore !== ' ';
    }
    
    // Function to fix casing
    function fixCasing(text) {
        if (!text) return text;
        
        // Capitalize first letter of the text
        text = text.charAt(0).toUpperCase() + text.slice(1);
        
        // Capitalize after periods, question marks, and exclamation marks
        text = text.replace(/([.!?]\s+)([a-z])/g, (match, p1, p2) => {
            return p1 + p2.toUpperCase();
        });
        
        // Common proper nouns and abbreviations (can be expanded)
        const properNouns = ['i', 'i\'m', 'i\'ll', 'i\'ve', 'i\'d'];
        properNouns.forEach(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            text = text.replace(regex, match => {
                return match.charAt(0).toUpperCase() + match.slice(1);
            });
        });
        
        return text;
    }
    
    // Function to get cursor position
    function getCursorPosition(element) {
        if (element.isContentEditable) {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                if (range.commonAncestorContainer.parentNode === element || 
                    range.commonAncestorContainer === element) {
                    return range.endOffset;
                }
            }
            return element.textContent.length;
        } else {
            return element.selectionStart || element.value.length;
        }
    }
    
    // Function to set cursor position
    function setCursorPosition(element, position) {
        if (element.isContentEditable) {
            const selection = window.getSelection();
            const range = document.createRange();
            
            // Find the text node
            let textNode = element.firstChild;
            if (!textNode) {
                textNode = document.createTextNode('');
                element.appendChild(textNode);
            }
            
            // Handle case where there might be multiple text nodes or elements
            if (textNode.nodeType !== Node.TEXT_NODE) {
                // Try to find a text node
                const textNodes = [];
                const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
                let node;
                while (node = walker.nextNode()) {
                    textNodes.push(node);
                }
                
                if (textNodes.length > 0) {
                    // Find the appropriate text node and position
                    let currentPos = 0;
                    for (let i = 0; i < textNodes.length; i++) {
                        const nodeLength = textNodes[i].length;
                        if (currentPos + nodeLength >= position) {
                            textNode = textNodes[i];
                            position = position - currentPos;
                            break;
                        }
                        currentPos += nodeLength;
                    }
                }
            }
            
            // Set position
            const actualPosition = Math.min(position, textNode.length);
            range.setStart(textNode, actualPosition);
            range.setEnd(textNode, actualPosition);
            
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            element.selectionStart = position;
            element.selectionEnd = position;
        }
    }
    
    // Function to insert text at cursor position
    function insertAtCursor(text, insertion, position) {
        if (!text) return insertion;
        
        // Add a space before insertion if needed
        const needsSpace = shouldAddSpace(text, position);
        
        const prefix = text.substring(0, position);
        const suffix = text.substring(position);
        
        return prefix + (needsSpace ? ' ' : '') + insertion + suffix;
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
