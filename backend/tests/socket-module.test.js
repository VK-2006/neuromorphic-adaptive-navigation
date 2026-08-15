test('Socket.IO module exports initializer',()=>{const s=require('../src/sockets');expect(typeof s.init).toBe('function')});
