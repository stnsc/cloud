function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Simple password hashing using PBKDF2
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt']
  );
  
  const exported = await crypto.subtle.exportKey('raw', key);
  const hashArray = new Uint8Array(exported as ArrayBuffer);
  const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `${saltHex}:${hashHex}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const [saltHex, hashHex] = storedHash.split(':');
    const salt = new Uint8Array(saltHex.match(/[\da-f]{2}/gi)!.map((h: string) => parseInt(h, 16)));
    
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt']
    );
    
    const exported = await crypto.subtle.exportKey('raw', key);
    const hashArray = new Uint8Array(exported as ArrayBuffer);
    const hash = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hash === hashHex;
  } catch (error) {
    return false;
  }
}

// JWT creation with HMAC-SHA256 signature
async function createJWT(userId: string, username: string, secret: string): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    userId,
    username,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days
  }));
  
  const message = `${header}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const signatureArray = new Uint8Array(signature);
  const signatureBase64 = btoa(String.fromCharCode(...signatureArray));
  
  return `${message}.${signatureBase64}`;
}

async function verifyJWT(token: string, secret: string): Promise<{ userId: string; username: string } | null> {
  try {
    if (!token) return null;
    
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [header, payload, signature] = parts;
    const message = `${header}.${payload}`;
    
    // Verify signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    const signatureBytes = new Uint8Array(atob(signature).split('').map(c => c.charCodeAt(0)));
    const isValid = await crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(message));
    
    if (!isValid) return null;
    
    const payloadData = JSON.parse(atob(payload));
    
    // Check expiration
    if (payloadData.exp && payloadData.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    
    return { userId: payloadData.userId, username: payloadData.username };
  } catch {
    return null;
  }
}

const STORAGE_LIMIT = 1024 * 1024 * 1024; // 1GB in bytes

async function getUserStorageUsage(env: Env, userId: string): Promise<number> {
  const result = await env.DB.prepare(
    'SELECT COALESCE(SUM(size), 0) as total FROM files WHERE user_id = ?'
  ).bind(userId).first() as any;
  return result?.total || 0;
}

interface Env {
  R2_BUCKET: R2Bucket;
  DB: D1Database;
  ACCESS_CODE: string;
  JWT_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Public auth endpoints
      if (path === '/api/auth/register' && method === 'POST') {
        return await handleRegister(request, env, corsHeaders);
      } else if (path === '/api/auth/login' && method === 'POST') {
        return await handleLogin(request, env, corsHeaders);
      }

      // All other endpoints require auth
      const authHeader = request.headers.get('Authorization');
      const token = authHeader?.replace('Bearer ', '') || '';
      const user = await verifyJWT(token, env.JWT_SECRET);

      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (path === '/api/files' && method === 'GET') {
        return await handleListFiles(env, user.userId, corsHeaders);
      } else if (path === '/api/files/upload' && method === 'POST') {
        return await handleUploadFile(request, env, user.userId, corsHeaders);
      } else if (path.match(/^\/api\/files\/[^/]+$/) && method === 'DELETE') {
        const fileId = path.split('/').pop();
        if (fileId) return await handleDeleteFile(env, user.userId, fileId, corsHeaders);
      } else if (path.match(/^\/api\/files\/[^/]+\/download$/) && method === 'GET') {
        const fileId = path.split('/')[3];
        return await handleDownloadFile(env, user.userId, fileId, corsHeaders);
      } else if (path.match(/^\/api\/files\/[^/]+\/share$/) && method === 'POST') {
        const fileId = path.split('/')[3];
        return await handleShareFile(request, env, user.userId, fileId, corsHeaders);
      } else if (path === '/api/storage' && method === 'GET') {
        return await handleGetStorage(env, user.userId, corsHeaders);
      }

      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};

async function handleListFiles(env: Env, userId: string, corsHeaders: any): Promise<Response> {
  const result = await env.DB.prepare(
    'SELECT id, name, size, created_at FROM files WHERE user_id = ?'
  ).bind(userId).all();

  const files = (result.results as any[]).map(f => ({
    id: f.id,
    name: f.name,
    size: f.size,
    owner: 'You',
    shared: false,
    createdAt: f.created_at,
  }));

  return new Response(JSON.stringify(files), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleUploadFile(
  request: Request,
  env: Env,
  userId: string,
  corsHeaders: any
): Promise<Response> {
  try {
    const formData = await request.formData();
    const fileEntry = formData.get('file');

    if (!fileEntry) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle File or Blob
    const file = fileEntry as unknown as { name: string; type: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> };
    const fileId = uuidv4();
    const buffer = await file.arrayBuffer();
    const fileName = file.name || 'file';
    const r2Key = `${userId}/${fileId}/${fileName}`;

    // Check storage limit
    const currentUsage = await getUserStorageUsage(env, userId);
    if (currentUsage + file.size > STORAGE_LIMIT) {
      return new Response(JSON.stringify({ 
        error: 'Storage limit exceeded', 
        limit: STORAGE_LIMIT,
        used: currentUsage,
        fileSize: file.size
      }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Upload to R2
    await env.R2_BUCKET.put(r2Key, buffer, {
      httpMetadata: {
        contentType: file.type || 'application/octet-stream',
      },
    });

    // Store metadata in D1
    await env.DB.prepare(
      'INSERT INTO files (id, user_id, name, size, mime_type, r2_key) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      fileId,
      userId,
      fileName,
      file.size,
      file.type || 'application/octet-stream',
      r2Key
    ).run();

    return new Response(
      JSON.stringify({
        id: fileId,
        name: fileName,
        size: file.size,
        owner: 'You',
        shared: false,
      }),
      {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Upload error:', error);
    return new Response(JSON.stringify({ error: 'Failed to upload file', details: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function handleDeleteFile(
  env: Env,
  userId: string,
  fileId: string,
  corsHeaders: any
): Promise<Response> {
  const file = await env.DB.prepare(
    'SELECT r2_key FROM files WHERE id = ? AND user_id = ?'
  ).bind(fileId, userId).first() as any;

  if (!file) {
    return new Response(JSON.stringify({ error: 'File not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Delete permissions first (foreign key dependency)
  await env.DB.prepare('DELETE FROM file_permissions WHERE file_id = ?').bind(fileId).run();
  
  // Delete from file list
  await env.DB.prepare('DELETE FROM folder_files WHERE file_id = ?').bind(fileId).run();
  
  // Delete from R2
  await env.R2_BUCKET.delete(file.r2_key);
  
  // Finally delete the file record
  await env.DB.prepare('DELETE FROM files WHERE id = ?').bind(fileId).run();

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleDownloadFile(
  env: Env,
  userId: string,
  fileId: string,
  corsHeaders: any
): Promise<Response> {
  const file = await env.DB.prepare(
    'SELECT r2_key, name FROM files WHERE id = ? AND user_id = ?'
  ).bind(fileId, userId).first() as any;

  if (!file) {
    return new Response(JSON.stringify({ error: 'File not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const r2Object = await env.R2_BUCKET.get(file.r2_key);

  if (!r2Object) {
    return new Response(JSON.stringify({ error: 'File not found in storage' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(r2Object.body, {
    headers: {
      ...corsHeaders,
      'Content-Type': r2Object.httpMetadata?.contentType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${file.name}"`,
    },
  });
}

async function handleShareFile(
  request: Request,
  env: Env,
  userId: string,
  fileId: string,
  corsHeaders: any
): Promise<Response> {
  const file = await env.DB.prepare(
    'SELECT id FROM files WHERE id = ? AND user_id = ?'
  ).bind(fileId, userId).first();

  if (!file) {
    return new Response(JSON.stringify({ error: 'File not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const shareToken = uuidv4();
  const permissionId = uuidv4();

  await env.DB.prepare(
    'INSERT INTO file_permissions (id, file_id, share_token, permission_type) VALUES (?, ?, ?, ?)'
  ).bind(permissionId, fileId, shareToken, 'view').run();

  const requestUrl = new URL(request.url);
  const shareUrl = `${requestUrl.origin}/share/${shareToken}`;

  return new Response(
    JSON.stringify({
      shareToken,
      shareUrl,
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function handleRegister(
  request: Request,
  env: Env,
  corsHeaders: any
): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { username, password, accessCode } = body;

    console.log('Register attempt:', { username, accessCode, envCode: env.ACCESS_CODE });

    // Check access code from environment variable
    if (accessCode !== env.ACCESS_CODE) {
      return new Response(JSON.stringify({ 
        error: 'Invalid access code',
        received: accessCode,
        expected: env.ACCESS_CODE 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!username || !password) {
      return new Response(JSON.stringify({ error: 'Username and password required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user exists
    const existing = await env.DB.prepare(
      'SELECT id FROM users WHERE username = ?'
    ).bind(username).first();

    if (existing) {
      return new Response(JSON.stringify({ error: 'Username already exists' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);
    const userId = uuidv4();

    await env.DB.prepare(
      'INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)'
    ).bind(userId, username, passwordHash).run();

    // Create JWT token
    const token = await createJWT(userId, username, env.JWT_SECRET);

    return new Response(
      JSON.stringify({ token, userId, username }),
      {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Register error:', error);
    return new Response(JSON.stringify({ error: 'Registration failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function handleLogin(
  request: Request,
  env: Env,
  corsHeaders: any
): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { username, password } = body;

    if (!username || !password) {
      return new Response(JSON.stringify({ error: 'Username and password required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find user
    const user = await env.DB.prepare(
      'SELECT id, password_hash FROM users WHERE username = ?'
    ).bind(username).first() as any;

    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify password
    const passwordValid = await verifyPassword(password, user.password_hash);
    if (!passwordValid) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create JWT token
    const token = await createJWT(user.id, username, env.JWT_SECRET);

    return new Response(
      JSON.stringify({ token, userId: user.id, username }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({ error: 'Login failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function handleGetStorage(
  env: Env,
  userId: string,
  corsHeaders: any
): Promise<Response> {
  try {
    const used = await getUserStorageUsage(env, userId);
    
    return new Response(
      JSON.stringify({
        used,
        limit: STORAGE_LIMIT,
        percentage: Math.round((used / STORAGE_LIMIT) * 100),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Storage error:', error);
    return new Response(JSON.stringify({ error: 'Failed to get storage info' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
