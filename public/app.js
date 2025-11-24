document.addEventListener('DOMContentLoaded', () => {
    const chatHistory = document.getElementById('chat-history');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');

    async function sendMessage() {
        const message = userInput.value.trim();
        if (!message) return;

        // 添加用户消息到界面
        chatHistory.innerHTML += `<div class="message user-message"><strong>你:</strong> ${message}</div>`;
        userInput.value = '';
        chatHistory.scrollTop = chatHistory.scrollHeight;

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: message }),
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            // 添加助手回复到界面
            chatHistory.innerHTML += `<div class="message assistant-message"><strong>心理学助手:</strong> ${data.reply.replace(/\n/g, '<br>')}</div>`;
            chatHistory.scrollTop = chatHistory.scrollHeight;

        } catch (error) {
            chatHistory.innerHTML += `<div class="message error-message">错误: ${error.message}</div>`;
        }
    }

    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (e) => e.key === 'Enter' && sendMessage());
});