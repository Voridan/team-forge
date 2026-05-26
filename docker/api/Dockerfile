# Stage 1: Install dependencies + generate Prisma client
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json yarn.lock prisma.config.ts ./
COPY prisma ./prisma
RUN yarn install --frozen-lockfile
RUN npx prisma generate

# Stage 2: Build TypeScript
FROM deps AS build
COPY src/ ./src/
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
RUN yarn build

# Stage 3a: Development (hot reload)
FROM deps AS development
COPY src/ ./src/
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
CMD ["yarn", "start:dev"]

# Stage 3b: Production (minimal runtime)
FROM node:22-alpine AS production
WORKDIR /app
COPY package.json yarn.lock prisma.config.ts ./
COPY prisma ./prisma
RUN yarn install --frozen-lockfile --production && yarn cache clean
RUN npx prisma generate
COPY --from=build /app/dist ./dist/
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
