from prometheus_client import Counter, Histogram

# Counters for success/failure of the schedule generation pipeline
PIPELINE_SUCCESS = Counter('schedule_pipeline_success_total', 'Number of successful schedule pipeline runs')
PIPELINE_FAILURE = Counter('schedule_pipeline_failure_total', 'Number of failed schedule pipeline runs')

# Histogram to measure duration of each pipeline stage (seconds)
STAGE_DURATION = Histogram('schedule_pipeline_stage_seconds', 'Duration of pipeline stages', ['stage'])
