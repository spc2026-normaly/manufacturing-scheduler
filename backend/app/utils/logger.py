from loguru import logger
import sys

# Configure logger: rotate every 10 MB, keep 7 days, async safe
logger.remove()  # remove default handler
logger.add(sys.stderr, level="ERROR")
logger.add(
    "logs/app_{time}.log",
    rotation="10 MB",
    retention="7 days",
    level="INFO",
    enqueue=True,
)

__all__ = ["logger"]
