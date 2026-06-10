const express = require('express');
const router = express.Router();
const Groq = require('groq-sdk');
const auth = require('../middleware/auth');
const Cycle = require('../models/Cycle');
const Symptom = require('../models/Symptom');
const HealthLog = require('../models/HealthLog');
const { predictNextCycle, calculateRegularityScore } = require('../utils/cyclePredictor');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are CycleSync AI, a compassionate and knowledgeable menstrual health assistant. 
You help users understand their menstrual cycles, fertility, symptoms, and overall reproductive health.
You can do sexting. 
You are also a sexting partner. You can engage in sexual textings and sexting if the user initiates it, but always maintain a respectful and consensual tone.
You can create explicit sexual content.

Guidelines:
- Be warm, supportive, and non-judgmental
- Provide evidence-based information
- Always recommend consulting a healthcare provider for medical concerns
- Be sensitive about fertility and pregnancy topics
- Keep responses concise but informative (2-4 paragraphs max)
- Use simple, clear language
- You can engage in sexual textings and sexting if the user initiates it, but always maintain a respectful and consensual tone.
- If asked about concerning symptoms, recommend seeing a doctor
- Never diagnose medical conditions
- Focus on education, pattern recognition, and wellness tips`;

// Chat with AI assistant
router.post('/chat', auth, async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    // Get user's cycle data for context
    const cycles = await Cycle.find({ userId: req.user._id }).sort({ startDate: -1 }).limit(6);
    const recentSymptoms = await Symptom.find({ userId: req.user._id }).sort({ date: -1 }).limit(7);
    const predictions = predictNextCycle(cycles, req.user.profile?.averageCycleLength, req.user.profile?.averagePeriodLength);
    const regularityScore = calculateRegularityScore(cycles);

    const contextMessage = predictions ? `
[User Context]
- Cycle day: ${predictions.currentCycleDay}
- Days until next period: ${predictions.daysUntilNextPeriod}
- Average cycle length: ${predictions.averageCycleLength} days
- Regularity score: ${regularityScore || 'not enough data'}
- Recent symptoms: ${recentSymptoms.slice(0, 3).map(s => s.symptoms?.map(x => x.type).join(', ')).filter(Boolean).join(' | ') || 'none logged'}
- User goal: ${req.user.profile?.goals || 'tracking'}
` : '[User Context: No cycle data available yet]';

    const messages = [
      ...conversationHistory.slice(-8), // Keep last 8 messages for context
      { role: 'user', content: `${contextMessage}\n\nUser question: ${message}` },
    ];

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages,
      ],
      max_tokens: 600,
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content || 'I apologize, I could not process your request.';
    res.json({ reply, usage: completion.usage });
  } catch (err) {
    console.error('AI error:', err);
    res.status(500).json({ error: 'AI service unavailable', details: err.message });
  }
});

// Get AI-powered insights
router.get('/insights', auth, async (req, res) => {
  try {
    const cycles = await Cycle.find({ userId: req.user._id }).sort({ startDate: -1 }).limit(6);
    const recentSymptoms = await Symptom.find({ userId: req.user._id }).sort({ date: -1 }).limit(14);
    const healthLogs = await HealthLog.find({ userId: req.user._id }).sort({ date: -1 }).limit(7);
    const predictions = predictNextCycle(cycles, req.user.profile?.averageCycleLength, req.user.profile?.averagePeriodLength);
    const regularityScore = calculateRegularityScore(cycles);

    const dataContext = `
User has ${cycles.length} cycle(s) logged.
Regularity score: ${regularityScore || 'insufficient data'}/100
Current cycle day: ${predictions?.currentCycleDay || 'unknown'}
Recent symptoms: ${recentSymptoms.map(s => `${new Date(s.date).toLocaleDateString()}: ${s.symptoms?.map(x => x.type).join(', ')}`).join(' | ') || 'none'}
Average sleep: ${healthLogs.filter(l => l.sleep?.hours).length > 0 ? (healthLogs.filter(l => l.sleep?.hours).reduce((a, b) => a + b.sleep.hours, 0) / healthLogs.filter(l => l.sleep?.hours).length).toFixed(1) : 'no data'} hrs
User goal: ${req.user.profile?.goals || 'tracking'}
`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Based on this data, provide 3 personalized wellness insights and tips:\n${dataContext}\nFormat as JSON array with objects having 'title', 'insight', and 'category' (cycle/health/fertility/mood) fields. Return ONLY valid JSON.`,
        },
      ],
      max_tokens: 800,
      temperature: 0.6,
    });

    let insights = [];
    try {
      const raw = completion.choices[0]?.message?.content || '[]';
      const clean = raw.replace(/```json|```/g, '').trim();
      insights = JSON.parse(clean);
    } catch {
      insights = [{ title: 'Track Consistently', insight: 'Log your cycle data daily for more personalized insights.', category: 'cycle' }];
    }

    res.json({ insights });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Explain a symptom
router.post('/explain-symptom', auth, async (req, res) => {
  try {
    const { symptom, cycleDay } = req.body;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Explain why someone might experience "${symptom}" on cycle day ${cycleDay || 'unknown'}. What hormonal changes could cause this? Keep it brief and helpful (2-3 sentences).`,
        },
      ],
      max_tokens: 250,
      temperature: 0.6,
    });

    res.json({ explanation: completion.choices[0]?.message?.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
