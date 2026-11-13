# Workpeg builds functions without internet access, so start from Workpeg's
# function base image (it already has the runtime) and install any extra
# packages only from the vendored wheels/ folder.
# Before submitting: pip download --only-binary=:all: --dest wheels -r requirements.txt
FROM registry.gitlab.com/workpeg/workpeg-sdk/pegfn-base:0.157.0
COPY wheels /wheels
COPY requirements.txt /app/requirements.txt
RUN pip install --no-index --find-links=/wheels -r /app/requirements.txt
COPY app /app/app
