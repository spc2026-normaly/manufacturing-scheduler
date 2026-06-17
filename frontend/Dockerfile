FROM node:22-alpine AS base

WORKDIR /app

# 패키지 파일 복사 및 의존성 설치
COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
