// ==================== CONFIGURATION ====================
// REPLACE THESE WITH YOUR JSONBIN CREDENTIALS
const BIN_ID = 'YOUR_BIN_ID_HERE';  // e.g., '65f8a2b3d4e5f6a7b8c9d0e1'
const API_KEY = 'YOUR_API_KEY_HERE'; // e.g., '$2a$10$xxxxxxxxxxxxxxxxxxxxxxxx'
// =========================================================

const API_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;
let allMessages = []; // Cache for search functionality

// Check if config is set
if (BIN_ID === 'YOUR_BIN_ID_HERE' || API_KEY === 'YOUR_API_KEY_HERE') {
    document.getElementById('messagesContainer').innerHTML = `
        <div class="empty-state" style="color: var(--error);">
            <p>⚠️ Configuration needed!</p>
            <p style="margin-top: 1rem; font-size: 0.9rem;">
                Please edit the BIN_ID and API_KEY in script.js<br>
                Get your free credentials at jsonbin.io
            </p>
        </div>
    `;
}

// API Functions
async function fetchMessages() {
    try {
        const response = await fetch(API_URL, {
            method: 'GET',
            headers: {
                'X-Master-Key': API_KEY
            }
        });
        
        if (!response.ok) throw new Error('Failed to fetch');
        
        const data = await response.json();
        return data.record.messages || [];
    } catch (error) {
        console.error('Fetch error:', error);
        showApiStatus('Connection failed', 'error');
        throw error;
    }
}

async function saveMessage(author, content) {
    const newMessage = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        author: author.trim(),
        content: content.trim(),
        timestamp: Date.now()
    };

    // Get current messages
    const currentMessages = await fetchMessages();
    
    // Add new message
    const updatedMessages = [newMessage, ...currentMessages];
    
    // Save back to JSONbin
    const response = await fetch(API_URL, {
        method: 'PUT',
        headers: {
            'X-Master-Key': API_KEY,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ messages: updatedMessages })
    });

    if (!response.ok) throw new Error('Failed to save');
    
    return newMessage;
}

// UI Functions
function showNotification(message, type = 'success') {
    const notif = document.getElementById('notification');
    notif.textContent = message;
    notif.className = `notification ${type} show`;
    setTimeout(() => {
        notif.classList.remove('show');
    }, 3000);
}

function showApiStatus(text, type) {
    const status = document.getElementById('apiStatus');
    status.textContent = text;
    status.className = `api-status show ${type}`;
}

function updateStats(messages) {
    document.getElementById('totalMessages').textContent = messages.length;
    const uniqueAuthors = new Set(messages.map(m => m.author.toLowerCase())).size;
    document.getElementById('uniqueAuthors').textContent = uniqueAuthors;
}

function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
}

function highlightText(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function renderMessages(messages, searchQuery = '') {
    const container = document.getElementById('messagesContainer');
    
    if (messages.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <p>${searchQuery ? 'No messages match your search.' : 'No messages yet. Be the first to write something!'}</p>
            </div>
        `;
        return;
    }

    // Sort by newest first
    messages.sort((a, b) => b.timestamp - a.timestamp);

    container.innerHTML = messages.map(msg => `
        <div class="message-card" data-id="${msg.id}">
            <div class="message-header">
                <div class="author-name">
                    <div class="author-avatar">${getInitials(msg.author)}</div>
                    <span>${highlightText(escapeHtml(msg.author), searchQuery)}</span>
                </div>
                <span class="timestamp">${formatDate(msg.timestamp)}</span>
            </div>
            <div class="message-content">${highlightText(escapeHtml(msg.content), searchQuery)}</div>
        </div>
    `).join('');
}

function filterMessages(query) {
    const lowerQuery = query.toLowerCase();
    const filtered = allMessages.filter(msg => 
        msg.author.toLowerCase().includes(lowerQuery) || 
        msg.content.toLowerCase().includes(lowerQuery)
    );
    renderMessages(filtered, query);
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    renderMessages(allMessages);
}

async function loadMessages() {
    try {
        const messages = await fetchMessages();
        allMessages = messages;
        renderMessages(messages);
        updateStats(messages);
        showApiStatus('Connected to cloud', 'connected');
    } catch (error) {
        document.getElementById('messagesContainer').innerHTML = `
            <div class="empty-state" style="color: var(--error);">
                <p>Failed to load messages. Check your API key.</p>
            </div>
        `;
    }
}

// Event Listeners
document.getElementById('messageForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const authorInput = document.getElementById('author');
    const contentInput = document.getElementById('content');
    const submitBtn = document.getElementById('submitBtn');
    
    const author = authorInput.value.trim();
    const content = contentInput.value.trim();
    
    if (!author || !content) {
        showNotification('Please fill in all fields', 'error');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading"></span>Posting...';

    try {
        await saveMessage(author, content);
        contentInput.value = '';
        showNotification('Message posted successfully!');
        await loadMessages(); // Refresh list
    } catch (error) {
        console.error(error);
        showNotification('Error posting message. Try again.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Post Message';
    }
});

document.getElementById('searchInput').addEventListener('input', function(e) {
    filterMessages(e.target.value);
});

// Auto-refresh every 30 seconds to see new messages from others
setInterval(() => {
    if (document.getElementById('searchInput').value === '') {
        loadMessages();
    }
}, 30000);

// Initialize
if (BIN_ID !== 'YOUR_BIN_ID_HERE' && API_KEY !== 'YOUR_API_KEY_HERE') {
    loadMessages();
      }
      
