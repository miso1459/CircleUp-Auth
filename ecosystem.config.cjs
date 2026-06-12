module.exports = {
  apps: [{
    name: "CircleUp-Auth",
    script: "./server.js",

    // 👇 클러스터 모드 활성화 설정
    exec_mode: 'cluster',     // 실행 모드를 클러스터로 지정
    instances: 'max',         // 'max'로 설정 시 이용 가능한 CPU 코어 수만큼 프로세스 자동 생성 (예: 4코어면 4개)

    watch: false,
    autorestart: true, // 🟢 오류 발생 시 자동으로 1초 만에 재시작해 주는 옵션
    env: {
      PORT: "3000",
      NODE_ENV: "production",
      ORIGIN: "http://circleup-auth.duckdns.org:3000" // 🟢 로그인 먹통을 막기 위한 실제 접속 주소
    }
  }]
}
