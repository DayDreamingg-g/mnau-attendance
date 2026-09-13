import { NextRequest,NextResponse } from 'next/server';
export function proxy(request:NextRequest){
  if(!request.cookies.has('mnau_session'))return NextResponse.redirect(new URL('/login',request.url));
  return NextResponse.next();
}
export const config={matcher:['/','/specialties/:path*','/groups/:path*','/students/:path*','/teacher/:path*','/starosta/:path*','/curator/:path*','/reports/:path*','/admin/:path*','/sources/:path*']};
