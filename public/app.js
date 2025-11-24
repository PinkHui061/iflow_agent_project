// document.addEventListener('DOMContentLoaded', () => {
//     const chatHistory = document.getElementById('chat-history');
//     const userInput = document.getElementById('user-input');
//     const sendButton = document.getElementById('send-button');

//     async function sendMessage() {
//         const message = userInput.value.trim();
//         if (!message) return;

//         // 添加用户消息到界面
//         chatHistory.innerHTML += `<div class="message user-message"><strong>你:</strong> ${message}</div>`;
//         userInput.value = '';
//         chatHistory.scrollTop = chatHistory.scrollHeight;

//         try {
//             const response = await fetch('/api/chat', {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify({ message: message }),
//             });

//             const data = await response.json();
//             if (data.error) throw new Error(data.error);

//             // 添加助手回复到界面
//             chatHistory.innerHTML += `<div class="message assistant-message"><strong>心理学助手:</strong> ${data.reply.replace(/\n/g, '<br>')}</div>`;
//             chatHistory.scrollTop = chatHistory.scrollHeight;

//         } catch (error) {
//             chatHistory.innerHTML += `<div class="message error-message">错误: ${error.message}</div>`;
//         }
//     }

//     sendButton.addEventListener('click', sendMessage);
//     userInput.addEventListener('keypress', (e) => e.key === 'Enter' && sendMessage());
// });
class PsychologyAssistant {
    constructor() {
        this.apiBase = '/api';
        this.isProcessing = false;
        this.initializeApp();
    }

    initializeApp() {
        this.setWelcomeTime();
        this.initializeEventListeners();
        this.checkHealth();
    }

    setWelcomeTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('zh-CN', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        document.getElementById('welcome-time').textContent = timeString;
    }

    initializeEventListeners() {
        const sendButton = document.getElementById('send-button');
        const userInput = document.getElementById('user-input');
        const quickButtons = document.querySelectorAll('.quick-btn');

        sendButton.addEventListener('click', () => this.sendMessage());
        
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        userInput.addEventListener('input', () => {
            this.adjustTextareaHeight(userInput);
        });

        quickButtons.forEach(button => {
            button.addEventListener('click', () => {
                const query = button.getAttribute('data-query');
                userInput.value = query;
                this.sendMessage();
            });
        });
    }

    adjustTextareaHeight(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }

    async checkHealth() {
        const statusIndicator = document.getElementById('status-indicator');
        const statusDot = statusIndicator.querySelector('.status-dot');
        const statusText = statusIndicator.querySelector('span');

        try {
            const response = await fetch(this.apiBase + '/health');
            const data = await response.json();
            
            statusDot.style.background = '#48bb78';
            statusText.textContent = `服务正常 ${data.hasApiKey ? '🔑' : '⚠️'}`;
            statusText.title = data.hasApiKey ? 'API密钥已配置' : 'API密钥未配置';
            
        } catch (error) {
            statusDot.style.background = '#f56565';
            statusText.textContent = '服务异常';
            console.error('健康检查失败:', error);
        }
    }

    async sendMessage() {
        if (this.isProcessing) return;

        const userInput = document.getElementById('user-input');
        const message = userInput.value.trim();
        
        if (!message) return;

        this.isProcessing = true;
        userInput.disabled = true;
        document.getElementById('send-button').disabled = true;

        // 添加用户消息
        this.addMessage(message, 'user');
        userInput.value = '';
        this.adjustTextareaHeight(userInput);

        // 显示输入指示器
        this.showTypingIndicator();

        try {
            const response = await fetch(this.apiBase + '/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message
                })
            });

            const data = await response.json();
            this.hideTypingIndicator();

            if (data.error) {
                this.addMessage(`错误: ${data.error}`, 'assistant', 'error');
            } else {
                this.addMessage(data.reply, 'assistant', data.type);
            }

        } catch (error) {
            this.hideTypingIndicator();
            this.addMessage('网络错误，请检查连接或稍后重试', 'assistant', 'error');
            console.error('发送消息失败:', error);
        } finally {
            this.isProcessing = false;
            userInput.disabled = false;
            document.getElementById('send-button').disabled = false;
            userInput.focus();
        }
    }

    addMessage(content, type, messageType = 'normal') {
        const chatMessages = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        
        const now = new Date();
        const timeString = now.toLocaleTimeString('zh-CN', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        const avatar = type === 'user' ? '👤' : '🤖';
        const sender = type === 'user' ? '您' : '心理学助手';

        messageDiv.className = `message ${type}-message`;
        messageDiv.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">
                <div class="message-sender">${sender}</div>
                <div class="message-text">${this.formatMessage(content, messageType)}</div>
                <div class="message-time">${timeString}</div>
            </div>
        `;

        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    formatMessage(content, messageType) {
        if (messageType === 'error') {
            return `<div style="color: #e53e3e; font-weight: 500;">${content}</div>`;
        }
        
        if (messageType === 'simulation') {
            return `<div style="opacity: 0.8; border-left: 3px solid #4299e1; padding-left: 1rem;">
                ${content.replace(/\n/g, '<br>')}
            </div>`;
        }
        
        // 基本的 Markdown 样式处理
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>')
            .replace(/- (.*?)(<br>|$)/g, '• $1<br>');
    }

    showTypingIndicator() {
        document.getElementById('typing-indicator').style.display = 'flex';
        const chatMessages = document.getElementById('chat-messages');
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    hideTypingIndicator() {
        document.getElementById('typing-indicator').style.display = 'none';
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new PsychologyAssistant();
});