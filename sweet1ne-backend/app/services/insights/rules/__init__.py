from app.services.insights.registry import RULES

from app.services.insights.rules import kitchen  
from app.services.insights.rules import menu     
from app.services.insights.rules import marketing  
from app.services.insights.rules import guest     

# All four modules are in. If this ever disagrees with len(RULES), a module
# has been removed from the imports above.
EXPECTED_RULE_COUNT = 18


def check_registry() -> None:
    """Call once at startup."""
    if len(RULES) != EXPECTED_RULE_COUNT:
        raise RuntimeError(
            f"expected {EXPECTED_RULE_COUNT} insight rules, found {len(RULES)}: "
            f"{sorted(RULES)}. A rule module is probably not imported in "
            f"app/services/insights/rules/__init__.py"
        )