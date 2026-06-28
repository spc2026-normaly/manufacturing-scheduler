from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

# Retry wrapper for transient operations (e.g., R2 I/O, DB network glitches)
@retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=1, min=1, max=30),
    retry=retry_if_exception_type((ConnectionError, TimeoutError, OSError))
)
def resilient_call(fn, *args, **kwargs):
    """Execute ``fn`` with retry logic.
    ``fn`` should be a callable returning the desired result.
    """
    return fn(*args, **kwargs)
