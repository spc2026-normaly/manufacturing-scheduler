FROM grafana/grafana:11.0.0

# 기존 Docker 버전에서 사용하던 Grafana provisioning 파일과 대시보드를
# 이미지 안에 그대로 넣어서, 쿠버네티스에서도 같은 화면을 자동으로 띄운다.
COPY monitoring/grafana/provisioning /etc/grafana/provisioning
