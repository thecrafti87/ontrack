FROM node:24-alpine

WORKDIR /app

# Abhängigkeiten zuerst (besseres Layer-Caching)
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Datenbank-Pfad relativ zur prisma/schema.prisma → /app/prisma/data/ontrack.db
ENV DATABASE_URL="file:./data/ontrack.db"
ENV NODE_ENV=production

RUN npx prisma generate && npm run build

EXPOSE 3000

# Datenverzeichnisse sicherstellen (auch bei leerem Volume, z. B. Railway/Render),
# Migrationen anwenden, dann Server starten
CMD ["sh", "-c", "mkdir -p /app/data/db /app/data/uploads /app/prisma/data && npx prisma migrate deploy && npm start"]
