#!/bin/bash

# 색상 정의
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 에러 발생 시 중단
set -e

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}  배포 시작${NC}"
echo -e "${YELLOW}========================================${NC}"

# 1. Git pull
echo -e "\n${GREEN}[1/4] Git 최신 코드 가져오는 중...${NC}"
git fetch origin
git reset --hard origin/$(git rev-parse --abbrev-ref HEAD)
echo -e "${GREEN}✔ Git pull 완료${NC}"

# 2. pnpm install
echo -e "\n${GREEN}[2/4] 패키지 설치 중...${NC}"
pnpm install
echo -e "${GREEN}✔ pnpm install 완료${NC}"

# 3. pnpm run build
echo -e "\n${GREEN}[3/4] 🔨 빌드 중...${NC}"
pnpm run build
echo -e "${GREEN}✔ pnpm run build 완료${NC}"

# 4. node server.js
echo -e "\n${GREEN}[4/4] 서버 시작 중...${NC}"
echo -e "${YELLOW}========================================${NC}"
node server.js
