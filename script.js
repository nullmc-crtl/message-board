// ==================== CONFIGURATION ====================
// REPLACE THESE WITH YOUR JSONBIN CREDENTIALS
const BIN_ID = '69ba72c0aa77b81da9f5db56';  // e.g., '65f8a2b3d4e5f6a7b8c9d0e1'
const API_KEY = '$2a$10$eUjkpme5hJVtQPcOpITtpu2zZ4OmB2b9LuUFG.wLLqF47ARtMY66u'; // e.g., '$2a$10$xxxxxxxxxxxxxxxxxxxxxxxx'
// =========================================================

const API_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;
let allMessages = [];

// Admin password - CHANGE THIS!
const ADMIN_PASSWORD = 'admin123'; // Change to your secure password
const urlParams = new URLSearchParams(window.location.search);
const isAdmin = urlParams.get('admin') === ADMIN_PASSWORD;

// ==================== API FUNCTIONS ====================

async function fetchMessages() {
    try {
        const response = await fetch(API_URL, {
            method: 'GET',
            headers: { 'X-Master-Key': API_KEY }
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

async function saveAllMessages(messages) {
    const response = await fetch(API_URL, {
        method: 'PUT',
        headers: {
            'X-Master-Key': API_KEY,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ messages: messages })
    });
    if (!response.ok) throw new Error('Failed to save');
    return response.json();
}

async function saveMessage(author, content) {
    const newMessage = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        author: author.trim(),
        content: content.trim(),
        timestamp: Date.now(),
        ip: 'anonymous' // Could track IP if needed
    };
    const currentMessages = await fetchMessages();
    const updatedMessages = [newMessage, ...currentMessages];
    await saveAllMessages(updatedMessages);
    return newMessage;
}

// ==================== ADMIN FUNCTIONS ====================

// Delete single message
async function deleteMessage(messageId) {
    if (!confirm('Delete this message permanently?')) return;
    try {
        const messages = await fetchMessages();
        const updated = messages.filter(m => m.id !== messageId);
        await saveAllMessages(updated);
        showNotification('Message deleted!');
        await loadMessages();
    } catch (error) {
        showNotification('Error deleting', 'error');
    }
}

// Edit message
async function editMessage(messageId) {
    const messages = await fetchMessages();
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;

    const newContent = prompt('Edit message:', msg.content);
    if (newContent === null || newContent.trim() === '') return;

    const updated = messages.map(m => 
        m.id === messageId ? { ...m, content: newContent.trim(), edited: true } : m
    );
    
    try {
        await saveAllMessages(updated);
        showNotification('Message updated!');
        await loadMessages();
    } catch (error) {
        showNotification('Error updating', 'error');
    }
}

// Delete all messages
async function deleteAllMessages() {
    if (!confirm('⚠️ DELETE EVERYTHING?')) return;
    if (!confirm('Seriously? All messages gone forever?')) return;
    if (prompt('Type DELETE to confirm:') !== 'DELETE') {
        showNotification('Cancelled', 'error');
        return;
    }
    
    try {
        await saveAllMessages([]);
        showNotification('All messages deleted!');
        await loadMessages();
    } catch (error) {
        showNotification('Error', 'error');
    }
}

// Ban user (delete all messages by author)
async function banUser(authorName) {
    if (!confirm(`Ban "${authorName}" and delete all their messages?`)) return;
    
    try {
        const messages = await fetchMessages();
        const updated = messages.filter(m => m.author.toLowerCase() !== authorName.toLowerCase());
        const deletedCount = messages.length - updated.length;
        
        await saveAllMessages(updated);
        showNotification(`Banned ${authorName}! Deleted ${deletedCount} messages.`);
        await loadMessages();
    } catch (error) {
        showNotification('Error banning user', 'error');
    }
}

// Export all data to JSON file
function exportData() {
    const dataStr = JSON.stringify({ messages: allMessages }, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `guestbook-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showNotification('Data exported!');
}

// Import data from JSON
async function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        const text = await file.text();
        
        try {
            const data = JSON.parse(text);
            if (!confirm(`Import ${data.messages?.length || 0} messages? This will REPLACE current data!`)) return;
            
            await saveAllMessages(data.messages || []);
            showNotification('Data imported!');
            await loadMessages();
        } catch (err) {
            showNotification('Invalid JSON file', 'error');
        }
    };
    
    input.click();
}

// Search and filter for admin
function adminSearch(query) {
    const lower = query.toLowerCase();
    const results = allMessages.filter(m => 
        m.author.toLowerCase().includes(lower) || 
        m.content.toLowerCase().includes(lower) ||
        m.id.toLowerCase().includes(lower)
    );
    renderMessages(results, query, true); // true = show admin controls
}

// Show raw JSON
function viewRawData() {
    const win = window.open('', '_blank');
    win.document.write(`<pre style="background:#0f172a;color:#10b981;padding:20px;white-space:pre-wrap;">${JSON.stringify({messages: allMessages}, null, 2)}</pre>`);
}

// ==================== UI FUNCTIONS ====================

function showNotification(message, type = 'success') {
    const notif = document.getElementById('notification');
    notif.textContent = message;
    notif.className = `notification ${type} show`;
    setTimeout(() => notif.classList.remove('show'), 3000);
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
    
    // Admin stats
    if (isAdmin && document.getElementById('adminStats')) {
        const today = new Date().setHours(0,0,0,0);
        const todayCount = messages.filter(m => m.timestamp >= today).length;
        document.getElementById('todayMessages').textContent = todayCount;
    }
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

// ==================== RENDER ====================

function renderMessages(messages, searchQuery = '', forceAdmin = false) {
    const container = document.getElementById('messagesContainer');
    const showAdmin = isAdmin || forceAdmin;
    
    if (messages.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <p>${searchQuery ? 'No messages match.' : 'No messages yet.'}</p>
            </div>
        `;
        return;
    }

    messages.sort((a, b) => b.timestamp - a.timestamp);

    container.innerHTML = messages.map(msg => `
        <div class="message-card ${msg.edited ? 'edited' : ''}" data-id="${msg.id}">
            <div class="message-header">
                <div class="author-name">
                    <div class="author-avatar">${getInitials(msg.author)}</div>
                    <span>${highlightText(escapeHtml(msg.author), searchQuery)}</span>
                    ${msg.edited ? '<span class="edited-badge">edited</span>' : ''}
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <span class="timestamp">${formatDate(msg.timestamp)}</span>
                    ${showAdmin ? `
                        <button onclick="editMessage('${msg.id}')" class="admin-btn edit-btn" title="Edit">✏️</button>
                        <button onclick="deleteMessage('${msg.id}')" class="admin-btn delete-btn" title="Delete">🗑️</button>
                        <button onclick="banUser('${escapeHtml(msg.author)}')" class="admin-btn ban-btn" title="Ban User">🚫</button>
                    ` : ''}
                </div>
            </div>
            <div class="message-content">${highlightText(escapeHtml(msg.content), searchQuery)}</div>
            ${showAdmin ? `<div class="msg-id">ID: ${msg.id}</div>` : ''}
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
        showApiStatus(isAdmin ? 'Admin mode - Full access' : 'Connected', 'connected');
    } catch (error) {
        document.getElementById('messagesContainer').innerHTML = `
            <div class="empty-state" style="color: var(--error);">
                <p>Failed to load messages.</p>
            </div>
        `;
    }
}

// ==================== EVENT LISTENERS ====================

document.getElementById('messageForm')?.addEventListener('submit', async function(e) {
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
        showNotification('Message posted!');
        await loadMessages();
    } catch (error) {
        showNotification('Error posting', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Post Message';
    }
});

document.getElementById('searchInput')?.addEventListener('input', function(e) {
    filterMessages(e.target.value);
});

// Admin panel search
document.getElementById('adminSearch')?.addEventListener('input', function(e) {
    adminSearch(e.target.value);
});

// ==================== INIT ====================

if (isAdmin) {
    // Show admin panel
    document.addEventListener('DOMContentLoaded', () => {
        const adminPanel = document.getElementById('adminPanel');
        if (adminPanel) adminPanel.style.display = 'block';
    });
    console.log('%c🔐 ADMIN MODE ACTIVE', 'color: #10b981; font-size: 20px; font-weight: bold;');
    console.log('Available commands: deleteMessage(id), editMessage(id), banUser(name), deleteAllMessages(), exportData(), importData()');
}

// Check config
if (BIN_ID === 'YOUR_BIN_ID_HERE' || API_KEY === 'YOUR_API_KEY_HERE') {
    document.getElementById('messagesContainer').innerHTML = `
        <div class="empty-state" style="color: var(--error);">
            <p>⚠️ Configuration needed! Edit BIN_ID and API_KEY in script.js</p>
        </div>
    `;
} else {
    loadMessages();
    setInterval(() => {
        if (document.getElementById('searchInput')?.value === '') {
            loadMessages();
        }
    }, 30000);
            }
    
