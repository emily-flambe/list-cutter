from django.conf import settings

is_dev = "dev" in settings.ENVIRONMENT

reload = is_dev
timeout = 300
graceful_timeout = 60
keepalive = 5
worker_class = "sync"
workers = 1 if is_dev and settings.ENABLE_DEBUGGER else 4
threads = 1 if is_dev and settings.ENABLE_DEBUGGER else 4
max_requests = 1024
max_requests_jitter = 1024
loglevel = "info"
capture_output = True
log = "-"
accesslog = "-"
access_log_format = 'gunicorn %({X-Forwarded-For}i)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s'
bind = "0.0.0.0:8000"


def worker_abort(worker):
    worker.log.info("worker received SIGABRT signal")
    print(worker)
