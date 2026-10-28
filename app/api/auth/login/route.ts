import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/bd/connection';
import { createSessionToken, COOKIE_NAME } from '@/app/modules/auth/session';
import { AuthLoginSchema } from '@/lib/schemas';

export async function POST(req: Request) {
  try {
    const rawBody = await req.json().catch(() => null);
    const validation = AuthLoginSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || 'Datos de login inválidos' },
        { status: 400 }
      );
    }

    const { username, password } = validation.data;
    const trimmedUser = username.trim();

    const userRes = await query(`SELECT * FROM users WHERE username = $1 LIMIT 1`, [
      trimmedUser,
    ]);

    if (userRes.rowCount === 0) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    const user = userRes.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    const token = await createSessionToken({ userId: user.id, username: user.username });
    const response = NextResponse.json({
      ok: true,
      user: { id: user.id, username: user.username, business_name: user.business_name },
    });

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 días
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
