FROM node:24-alpine

WORKDIR /app

# Abhängigkeiten zuerst (besseres Layer-Caching)
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Absolute Pfade: der Standalone-Server wechselt beim Start in sein eigenes
# Verzeichnis (process.chdir), relative Angaben würden dadurch am Volume
# vorbeizeigen.
ENV DATABASE_URL="file:/app/prisma/data/ontrack.db"
ENV ONTRACK_DATA_DIR="/app/data"
ENV NODE_ENV=production

# build:standalone erzeugt zusätzlich .next/standalone samt public/ und
# .next/static — "next start" funktioniert mit output: "standalone" nicht.
RUN npm run build:standalone

EXPOSE 3000

# Datenverzeichnisse sicherstellen (auch bei leerem Volume, z. B. Railway/Render),
# Migrationen anwenden, dann Server starten
# /app/data/db muss mit angelegt werden: DEPLOY.md lässt Railway und Render
# DATABASE_URL auf file:/app/data/db/ontrack.db zeigen, und migrate deploy
# scheitert an einem fehlenden Verzeichnis.
CMD ["sh", "-c", "mkdir -p /app/data/db /app/data/uploads /app/prisma/data && npx prisma migrate deploy && node .next/standalone/server.js"]
