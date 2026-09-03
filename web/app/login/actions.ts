"use server";

import { randomBytes } from "crypto";
import { compare } from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

const SESSION_COOKIE_NAME = "mnau_session";
const SESSION_DAYS = 30;

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?error=missing");
  }

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
    include: {
      role: true,
    },
  });

  if (!user) {
    redirect("/login?error=invalid");
  }

  const passwordValid = await compare(
    password,
    user.passwordHash
  );

  if (!passwordValid) {
    redirect("/login?error=invalid");
  }

  const token = randomBytes(32).toString("hex");

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);

  await prisma.session.create({
    data: {
      token,
      expiresAt,
      userId: user.id,
    },
  });

  const cookieStore = await cookies();

  cookieStore.set(
    SESSION_COOKIE_NAME,
    token,
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    }
  );

  if (user.role.name === "TEACHER") {
    redirect("/teacher");
  }

  if (user.role.name === "STAROSTA") {
    redirect("/starosta");
  }

  redirect("/");
}