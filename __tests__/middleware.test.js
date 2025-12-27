const { requireAdmin } = require('../src/middleware/auth');

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      header: function(name) {
        return this.headers[name];
      }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();

    // Sauvegarder la vraie valeur
    process.env.ADMIN_API_KEY = 'test-secret-key';
  });

  test('devrait appeler next() si clé API valide', () => {
    req.headers['x-admin-key'] = 'test-secret-key';
    
    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('devrait retourner 401 si clé API manquante', () => {
    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  test('devrait retourner 401 si clé API invalide', () => {
    req.headers['x-admin-key'] = 'wrong-key';
    
    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  test('devrait être case-sensitive pour la clé', () => {
    req.headers['x-admin-key'] = 'TEST-SECRET-KEY';
    
    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
