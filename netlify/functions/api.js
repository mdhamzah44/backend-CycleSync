const serverless = require('serverless-http');
const { app, connectDB } = require('../../app');

const handler = serverless(app);

exports.handler = async (event, context) => {
  // Let the Mongo connection persist across warm invocations instead of
  // Lambda waiting for it to close on every call.
  context.callbackWaitsForEmptyEventLoop = false;

  await connectDB();

  return handler(event, context);
};
