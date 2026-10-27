import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/bd/connection';
import { createSessionToken, COOKIE_NAME } from '@/app/modules/auth/session';
import { AuthRegisterSchema } from '@/lib/schemas';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: Request) {
  try {
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    if (!checkRateLimit('register:' + clientIp, 5, 60_000).allowed) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes de registro. Intente nuevamente en un minuto.' },
        { status: 429 }
      );
    }

    const rawBody = await req.json().catch(() => null);
    const validation = AuthRegisterSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || 'Datos de registro inválidos' },
        { status: 400 }
      );
    }

    const { username, password, business_name } = validation.data;
    const trimmedUser = username.trim().toLowerCase();

    // Comprobar si el usuario ya existe
    const existing = await query(`SELECT id FROM users WHERE username = $1`, [trimmedUser]);
    if (existing.rowCount && existing.rowCount > 0) {
      return NextResponse.json(
        { error: 'El nombre de usuario ya está en uso. Por favor elige otro.' },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const res = await query(
      `
      INSERT INTO users (username, password_hash, business_name)
      VALUES ($1, $2, $3)
      RETURNING id, username, business_name, created_at
    `,
      [trimmedUser, passwordHash, business_name.trim()]
    );

    const newUser = res.rows[0];
    const token = await createSessionToken({ userId: newUser.id, username: newUser.username });

    const response = NextResponse.json({
      ok: true,
      user: { id: newUser.id, username: newUser.username, business_name: newUser.business_name },
    });

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error: any) {
    console.error('Error al registrar usuario:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor al procesar el registro.' },
      { status: 500 }
    );
  }
}
