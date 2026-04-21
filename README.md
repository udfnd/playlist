This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Spotify 연결 설정

1. <https://developer.spotify.com/dashboard>에서 앱을 생성합니다.
2. Client ID / Client Secret을 `.env.local`의 `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`에 입력합니다.
3. Redirect URI로 `http://127.0.0.1:3000/api/auth/spotify/callback` (로컬)과 배포 환경의 동일한 경로를 Dashboard에 등록합니다.
4. 앱 접속 후 `/home`의 "Spotify 연결하기"를 눌러 OAuth를 완료합니다.

요청 스코프: `playlist-read-private`, `playlist-read-collaborative`, `user-read-email`.
