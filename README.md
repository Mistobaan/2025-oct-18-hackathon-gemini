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

## Python API backend

This project now includes a Python-powered API in `api/python/index.py`, implemented as a Vercel Serverless Function using the [Python runtime](https://vercel.com/docs/functions/runtimes/python). The handler responds to:

- `GET /api/python` &rarr; returns a JSON health payload confirming the Python backend is live.
- `POST /api/python` &rarr; accepts a JSON body with an optional `expression` field and echoes the value and its length, making it easy to expand the endpoint later.

Example requests:

```bash
curl https://<your-deployment>.vercel.app/api/python

curl -X POST https://<your-deployment>.vercel.app/api/python \
  -H 'Content-Type: application/json' \
  -d '{"expression": "x^2 + y^2"}'
```

Because the function only relies on the Python standard library, no additional `requirements.txt` is necessary. Add dependencies later by following the same runtime documentation linked above.
