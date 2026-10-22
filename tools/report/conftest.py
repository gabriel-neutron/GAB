import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent))


def pytest_collection_modifyitems(config, items):
    """WeasyPrint needs the Pango library; without it a test of the PDF is skipped, not failed."""
    try:
        import weasyprint  # noqa: F401
    except (ImportError, OSError) as e:
        if os.environ.get("CI"):
            raise
        skip = pytest.mark.skip(reason=f"WeasyPrint is not usable: {e.__class__.__name__}")
        for item in items:
            item.add_marker(skip)
