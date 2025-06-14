export const withCors = (handler) => async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      },
      body: '',
    };
  }

  const result = await handler(event);

  return {
    ...result,
    headers: {
      ...(result.headers || {}),
      'Access-Control-Allow-Origin': '*',
    },
  };
};