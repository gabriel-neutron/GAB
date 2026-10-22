import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))


@pytest.fixture(autouse=True)
def default_options():
    """Each test starts with the default locale and the strict document check."""
    import style
    style.configure()
