document.addEventListener('DOMContentLoaded', function() {
  console.log('Popup DOM loaded');
  
  const startButton = document.getElementById('startButton');
  const statusDiv = document.getElementById('status');

  if (!startButton || !statusDiv) {
      console.error('Required elements not found');
      return;
  }

  startButton.addEventListener('click', async function() {
      console.log('Button clicked');
      statusDiv.textContent = 'Starting voice input...';

      try {
          // Get the current active tab
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          
          if (!tab) {
              throw new Error('No active tab found');
          }

          // Check if the URL is restricted
          if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://')) {
              statusDiv.textContent = 'Voice input is not available on this page';
              return;
          }

          // Inject the content script
          await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
          }).catch(error => {
              console.error('Script injection error:', error);
              throw new Error('Cannot access this page. Try a different website.');
          });

          // Send message to content script
          chrome.tabs.sendMessage(tab.id, { action: 'startVoiceInput' }, function(response) {
              if (chrome.runtime.lastError) {
                  console.error('Error:', chrome.runtime.lastError.message);
                  statusDiv.textContent = 'Please try on a regular webpage';
                  return;
              }
              
              if (response && response.success) {
                  statusDiv.textContent = 'Voice input started';
              } else {
                  statusDiv.textContent = response?.error || 'Failed to start voice input';
              }
          });

      } catch (error) {
          console.error('Error:', error);
          statusDiv.textContent = error.message;
      }
  });
});