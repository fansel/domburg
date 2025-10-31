import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import * as bcrypt from "bcryptjs";
import { createToken } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username und Passwort erforderlich" },
        { status: 400 }
      );
    }

    // Finde User per Username
    const user = await prisma.user.findFirst({
      where: { 
        username,
        isActive: true 
      },
    });

    if (!user || !user.password) {
      return NextResponse.json(
        { error: "Ungültige Anmeldedaten" },
        { status: 401 }
      );
    }

    // Prüfe Passwort
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Ungültige Anmeldedaten" },
        { status: 401 }
      );
    }

    // Update lastLoginAt
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Log Activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "USER_LOGIN_PASSWORD",
        details: { username: user.username },
      },
    });

    // Erstelle JWT Token
    const token = await createToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Set Cookie
    cookies().set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 Tage
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Fehler bei der Anmeldung" },
      { status: 500 }
    );
  }
}

