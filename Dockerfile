FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run prisma:generate && pnpm run build
# Compile prisma.config.ts to JS for runtime use
RUN ./node_modules/.bin/tsc prisma.config.ts --outDir prisma-config-dist --module commonjs --target es2020 --esModuleInterop --skipLibCheck 2>/dev/null || \
    node -e "const fs=require('fs');const src=fs.readFileSync('prisma.config.ts','utf8');fs.writeFileSync('prisma-config-dist/prisma.config.js',src.replace(/^import\s+/gm,'// import ').replace(/export default/,'module.exports ='))"

FROM node:22-alpine AS production
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY package.json pnpm-workspace.yaml ./

EXPOSE 3000
CMD ["sh", "-c", "node scripts/prisma-migrate-deploy.js && node dist/prisma/seed.js && node dist/src/main"]
