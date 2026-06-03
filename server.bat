# 1. 기존 프로세스 삭제
pm2 delete circleup-auth

# 2. 새로 실행
pm2 start server.js --name "circleup-auth" --max-restarts 5


pause