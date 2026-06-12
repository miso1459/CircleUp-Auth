# SvelteKit -encTools Energy Materials 

# 종료
taskkill /F /IM cmd.exe
taskkill /F /IM node.exe

# 패키지 설치
pnpm install

# 1. 프로젝트 폴더로 이동
cd D:\Svelte\CircleUp\CircleUp-Auth

# 2. 설정 파일을 기반으로 안전하게 PM2 구동
pm2 start ecosystem.config.cjs

# 3. 윈도우 서버 재부팅을 대비해 현재 상태 완전 저장
pm2 save

# 모니터링
pm2 monit

# 재적용
pm2 reload all