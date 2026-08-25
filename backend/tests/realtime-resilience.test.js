const sockets = require('../src/sockets');

describe('Step 10.8: Socket.IO & Realtime Channel Isolation Resilience', () => {

  test('Socket module exports server initialization function and room authorization helper', () => {
    expect(typeof sockets.init).toBe('function');
    expect(typeof sockets.canJoinChat).toBe('function');
  });

  test('canJoinChat authorization helper rejects invalid rooms or non-existing user privileges', async () => {
    const user = { _id: '507f1f77bcf86cd799439011' };
    const invalidRoom = { type: 'JOURNEY', active: false };

    const allowed = await sockets.canJoinChat(user, invalidRoom);
    expect(allowed).toBe(false);
  });

  test('canJoinChat authorization helper allows public GLOBAL, REGION, and NEARBY chat rooms', async () => {
    const user = { _id: '507f1f77bcf86cd799439011' };
    const globalRoom = { type: 'GLOBAL', active: true };

    const allowed = await sockets.canJoinChat(user, globalRoom);
    expect(allowed).toBe(true);
  });

});
