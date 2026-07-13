// Local/dev entry point. On Netlify, netlify/functions/api.js is the entry
// point instead — it imports the same app from ./app.js and wraps it with
// serverless-http, so route logic only lives in one place.
const { app, connectDB } = require('./app');

connectDB();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 CycleSync server running on port ${PORT}`));

module.exports = app;
