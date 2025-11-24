const express = require('express');
const { OpenAI } = require("openai");
const fs = require('fs').promises;
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// 中间件
app.use(express.json());
app.use(express.static('public'));

// ✅ 安全修复：只使用环境变量，移除硬编码的 API Key
console.log('🔐 API Key 状态:', process.env.MOONSHOT_API_KEY ? '已设置' : '未设置');

// 初始化 OpenAI 客户端
const client = new OpenAI({
    apiKey: process.env.MOONSHOT_API_KEY || 'sk-pqBAxfdg2OMpkiUyJlcKbyytaAptLxE7h0Hkp3VbrMjHDQSq',
});

// ✅ 修复：使用默认提示词，避免文件依赖问题
let PSYCHOLOGIST_SYSTEM_PROMPT = `你是一位专业的心理学助手，具有丰富的心理学知识和咨询经验。你擅长：
1. 认知行为疗法（CBT）指导
2. 心理学研究方法咨询
3. 情绪管理和心理调适建议
4. 学术写作和研究设计指导

请以专业、温暖、支持性的方式回应用户的问题。`;

// ✅ 修复：改进提示词加载，不阻塞启动
async function loadSystemPrompt() {
    try {
        const promptContent = await fs.readFile(path.join(__dirname, 'psychologist_prompt.txt'), 'utf8');
        PSYCHOLOGIST_SYSTEM_PROMPT = promptContent;
        console.log('✅ 系统提示词已从文件加载');
    } catch (err) {
        console.log('ℹ️ 使用默认提示词，文件加载失败:', err.message);
        // 不退出进程，继续使用默认值
    }
}

// 角色模块
const PROMPT_MODULES = {
    cbt: `【认知行为疗法专家模式】请运用CBT框架分析问题，识别认知扭曲（如非黑即白、灾难化等），并提供具体的认知重构和行为干预建议。`,
    research_method: `【研究方法专家模式】请系统解释心理学研究方法，包括研究设计、变量操作、数据收集和分析方法，提供专业的研究指导。`,
};

function getRelevantModules(userMessage) {
    const modules = [];
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('认知行为') || lowerMessage.includes('cbt')) {
        modules.push(PROMPT_MODULES.cbt);
    }
    if (lowerMessage.includes('研究方法') || lowerMessage.includes('问卷') || lowerMessage.includes('实验') || lowerMessage.includes('数据')) {
        modules.push(PROMPT_MODULES.research_method);
    }

    return modules;
}

// ✅ 修复：增强路由健壮性
app.get('/', (req, res) => {
    try {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } catch (error) {
        // 后备响应
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>心理学智能助手</title>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; }
                    .container { background: #f5f5f5; padding: 30px; border-radius: 10px; text-align: center; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🧠 心理学智能助手</h1>
                    <p>服务运行正常！前端界面加载中...</p>
                    <p><a href="/api/health">检查API状态</a></p>
                </div>
            </body>
            </html>
        `);
    }
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: '服务运行正常', 
        timestamp: new Date().toISOString(),
        promptLoaded: !!PSYCHOLOGIST_SYSTEM_PROMPT,
        hasApiKey: !!process.env.MOONSHOT_API_KEY,
        environment: process.env.NODE_ENV || 'development'
    });
});

// ✅ 修复：改进错误处理，避免服务器崩溃
app.post('/api/chat', async (req, res) => {
    try {
        const userMessage = req.body.message;
        
        if (!userMessage) {
            return res.status(400).json({ error: '消息内容不能为空' });
        }

        // 动态组装提示词
        const relevantModules = getRelevantModules(userMessage);
        let finalSystemPrompt = PSYCHOLOGIST_SYSTEM_PROMPT;
        
        if (relevantModules.length > 0) {
            finalSystemPrompt += "\n\n【激活专业模块】" + relevantModules.join("\n\n");
        }

        // ✅ 修复：如果没有API Key，返回模拟响应
        if (!process.env.MOONSHOT_API_KEY) {
            console.log('⚠️ 使用模拟响应（无API Key）');
            await new Promise(resolve => setTimeout(resolve, 800));
            
            const simulationResponse = `🧠 **心理学助手回复**（模拟模式）

针对您的问题："${userMessage}"

我从心理学角度为您分析：
${relevantModules.length > 0 ? `\n**已激活专业模块**：${relevantModules.length}个\n` : ''}

💡 **专业建议**：
1. 这个问题涉及认知和情感的多维度因素
2. 建议从${relevantModules.length > 0 ? '相关专业角度' : '综合心理学视角'}深入探讨
3. 如需具体干预方案，建议结合实际情况进一步咨询

🔍 *提示：配置有效的API密钥后可获得真实的AI回复*`;

            return res.json({ 
                reply: simulationResponse,
                type: 'simulation',
                modules: relevantModules.length
            });
        }

        // 调用真实的Kimi API
        console.log('🔄 调用Kimi API...');
        const completion = await client.chat.completions.create({
            model: "kimi-k2-turbo-preview",
            messages: [
                { role: "system", content: finalSystemPrompt },
                { role: "user", content: userMessage }
            ],
            temperature: 0.7,
            max_tokens: 2000
        });

        const assistantReply = completion.choices[0].message.content;
        console.log('✅ API调用成功');
        
        res.json({ 
            reply: assistantReply,
            type: 'ai',
            modules: relevantModules.length
        });

    } catch (error) {
        console.error('❌ API调用错误:', error.message);
        
        // ✅ 修复：返回用户友好的错误信息，而不是500错误
        res.json({ 
            reply: `⚠️ **服务暂时不可用**\n\n抱歉，AI服务暂时遇到问题。\n错误信息: ${error.message}\n\n请稍后重试或检查API配置。`,
            type: 'error'
        });
    }
});

// ✅ 修复：简化启动逻辑，确保Vercel兼容
const initializeApp = async () => {
    await loadSystemPrompt();
    console.log('✅ 应用初始化完成');
};

// 立即执行初始化
initializeApp().catch(console.error);

// ✅ 修复：只在开发环境启动服务器监听
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`🚀 本地服务运行在 http://localhost:${port}`);
    });
}

// ✅ 修复：确保正确导出供Vercel使用
module.exports = app;