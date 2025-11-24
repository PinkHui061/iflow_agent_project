require('dotenv').config();
const express = require('express');
const { OpenAI } = require("openai");
const fs = require('fs').promises; // 使用 promise 版本的 fs 模块，便于异步操作
const path = require('path'); // 用于处理文件路径

const app = express();
const port = process.env.PORT || 3000;

// 中间件
app.use(express.json());
app.use(express.static('public'));

// 初始化 OpenAI 客户端 (指向 Kimi API)
const client = new OpenAI({
    apiKey: 'sk-pqBAxfdg2OMpkiUyJlcKbyytaAptLxE7h0Hkp3VbrMjHDQSq',
    baseURL: "https://api.moonshot.cn/v1",
});

// 【核心】从文件加载基础系统提示词
let PSYCHOLOGIST_SYSTEM_PROMPT = "";
const promptFilePath = path.join(__dirname, 'psychologist_prompt.txt');

// 异步加载提示词文件
async function loadSystemPrompt() {
    try {
        PSYCHOLOGIST_SYSTEM_PROMPT = await fs.readFile(promptFilePath, 'utf8');
        console.log('系统提示词已从文件成功加载。');
    } catch (err) {
        console.error('错误：无法加载系统提示词文件！', err.message);
        // 在生产环境中，你可能希望在这里终止程序，因为缺少核心配置
        process.exit(1); 
    }
}

// 【高级功能】定义可动态加载的角色片段
const PROMPT_MODULES = {
    cbt: `
    你现在需要特别运用认知行为疗法 (CBT) 的框架来分析用户的问题。
    请识别用户可能存在的认知扭曲（如：非黑即白、灾难化、情绪推理等），
    并解释这些扭曲如何影响了他们的情绪和行为。提供基于CBT的具体干预建议。
    `,
    research_method: `
    你现在是一位研究方法专家。请清晰、系统地解释心理学研究方法。
    当用户询问如何设计研究时，你需要涵盖研究问题、变量定义、被试选择、
    具体研究设计（如实验法、相关法）、数据收集与分析方法等关键步骤。
    `,
};

// 分析用户消息，决定加载哪些模块
function getRelevantModules(userMessage) {
    const modules = [];
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('认知行为') || lowerMessage.includes('cbt')) {
        modules.push(PROMPT_MODULES.cbt);
    }
    if (lowerMessage.includes('研究方法') || lowerMessage.includes('问卷') || lowerMessage.includes('实验')) {
        modules.push(PROMPT_MODULES.research_method);
    }

    return modules;
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: '服务运行正常', 
        timestamp: new Date().toISOString(),
        promptLoaded: !!PSYCHOLOGIST_SYSTEM_PROMPT
    });
});

// API 端点，用于处理聊天请求
app.post('/api/chat', async (req, res) => {
    // 检查提示词是否已加载
    if (!PSYCHOLOGIST_SYSTEM_PROMPT) {
        return res.status(503).json({ error: '服务正在初始化，请稍后再试。' });
    }

    const userMessage = req.body.message;
    if (!userMessage) {
        return res.status(400).json({ error: 'Message is required' });
    }

    // 【高级功能】动态组装最终的提示词
    const relevantModules = getRelevantModules(userMessage);
    let finalSystemPrompt = PSYCHOLOGIST_SYSTEM_PROMPT;
    
    if (relevantModules.length > 0) {
        finalSystemPrompt += "\n\n根据当前对话需求，你需要额外启用以下专业技能模块:\n" + relevantModules.join("\n\n");
    }

    try {
        const completion = await client.chat.completions.create({
            model: "kimi-k2-turbo-preview",
            messages: [
                { role: "system", content: finalSystemPrompt },
                { role: "user", content: userMessage }
            ],
            temperature: 0.7,
        });

        const assistantReply = completion.choices[0].message.content;
        res.json({ reply: assistantReply });

    } catch (error) {
        console.error('Error calling Kimi API:', error);
        const errorMessage = error.response ? error.response.data.error.message : error.message;
        res.status(500).json({ error: `Failed to get response from the AI: ${errorMessage}` });
    }
});

// 启动服务器
// async function startServer() {
//     await loadSystemPrompt(); // 等待提示词加载完毕后再启动服务器
//     app.listen(port, () => {
//         console.log(`Psychology Agent server is running on http://localhost:${port}`);
//     });
// }

const startServer = async () => {
    await loadSystemPrompt();
    
    if (process.env.NODE_ENV !== 'production') {
        app.listen(port, () => {
            console.log(`🚀 心理学助手服务运行在 http://localhost:${port}`);
        });
    }
};

// 启动服务器（开发环境）
if (require.main === module) {
    startServer();
}

module.exports = app;

// 执行启动函数
startServer();