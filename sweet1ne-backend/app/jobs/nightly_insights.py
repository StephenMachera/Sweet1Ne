"""
app/jobs/nightly_insights.py

Works out the insights for every client, once a night.

By hand:
    python -m app.jobs.nightly_insights
    python -m app.jobs.nightly_insights --tenant 0f8e...        # one client
    python -m app.jobs.nightly_insights --quiet                 # only problems

From cron on the VPS (03:30, a quiet hour):
    30 3 * * * cd /srv/sweet1ne && docker compose exec -T api \
        python -m app.jobs.nightly_insights >> /var/log/sweet1ne-insights.log 2>&1

The -T matters: without it docker compose wants a terminal, and cron has none.

Exit codes, so cron and any monitoring can tell what happened:
    0   every client done
    1   at least one client failed
    2   another run was already going, so this one did nothing
"""
import argparse
import fcntl
import logging
import sys
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone

from sqlalchemy import select

from app.db.session import SessionLocal                 
from app.models.tenant import Tenant                    
from app.models.insights_run import TRIGGER_NIGHTLY         
from app.services.insights import engine
from app.services.insights.rules import check_registry

log = logging.getLogger("insights.nightly")

# One run at a time. Note this is per container: if you ever run the app in two
# containers on one host, give them a shared volume for this path or move the
# lock into the database.
LOCK_PATH = "/tmp/sweet1ne-insights.lock"

EXIT_OK = 0
EXIT_FAILED = 1
EXIT_ALREADY_RUNNING = 2


class AlreadyRunning(RuntimeError):
    pass


@contextmanager
def only_one_run(path: str = LOCK_PATH):
    """Refuse to start if another run holds the lock.

    The engine's upsert makes a second run harmless rather than destructive,
    but two of them doing the same work at once is pointless, and a slow night
    should not pile up.
    """
    handle = open(path, "w")
    try:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except (BlockingIOError, OSError) as exc:
            raise AlreadyRunning(path) from exc
        handle.write(f"{datetime.now(timezone.utc).isoformat()}\n")
        handle.flush()
        yield
    finally:
        try:
            fcntl.flock(handle, fcntl.LOCK_UN)
        finally:
            handle.close()


def tenant_ids(explicit: str | None) -> list[uuid.UUID]:
    """Which clients to work through."""
    if explicit:
        return [uuid.UUID(explicit)]
    with SessionLocal() as db:
        return list(db.execute(select(Tenant.id).order_by(Tenant.id)).scalars())


def run_one(tenant_id: uuid.UUID) -> tuple[bool, str]:
    """One client, in its own session.

    A fresh session per client on purpose: if a run fails part-way the session
    is left dirty, and reusing it would carry that into the next client.

    When the rephrasing step exists it belongs at the end of this function, in
    a session of its own, AFTER the cards are saved and committed -- so a
    failure there costs the wording and never the cards:

        with SessionLocal() as db:
            rephrase_pending(db, tenant_id)
    """
    with SessionLocal() as db:
        try:
            report = engine.run_for_tenant(db, tenant_id, trigger=TRIGGER_NIGHTLY)
        except Exception as exc:                # one client must not stop the rest
            db.rollback()
            log.exception("insights failed for tenant %s", tenant_id)
            return False, f"{type(exc).__name__}: {exc}"

    if report.rules_failed:
        # The run finished and saved what it could, but some rules broke. Worth
        # a non-zero exit so somebody looks, rather than silently losing cards.
        log.warning(
            "tenant %s: %s -- rules failed: %s",
            tenant_id, report.summary(), report.rules_failed,
        )
        return False, report.summary()

    log.info("tenant %s: %s", tenant_id, report.summary())
    if report.rules_skipped:
        log.info("tenant %s waiting on: %s", tenant_id, report.rules_skipped)
    return True, report.summary()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Work out the insights for every client.")
    parser.add_argument("--tenant", help="One client's id, instead of all of them.")
    parser.add_argument("--quiet", action="store_true", help="Log warnings and errors only.")
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.WARNING if args.quiet else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )

    started = datetime.now(timezone.utc)
    try:
        with only_one_run():
            # Fails loudly if a rule module is not imported, rather than
            # quietly producing fewer cards than there should be.
            check_registry()

            ids = tenant_ids(args.tenant)
            if not ids:
                log.warning("no clients found, nothing to do")
                return EXIT_OK

            failures = []
            for tenant_id in ids:
                ok, _summary = run_one(tenant_id)
                if not ok:
                    failures.append(str(tenant_id))

            took = (datetime.now(timezone.utc) - started).total_seconds()
            if failures:
                log.error(
                    "finished in %.1fs with %d of %d clients in trouble: %s",
                    took, len(failures), len(ids), ", ".join(failures),
                )
                return EXIT_FAILED
            log.info("finished in %.1fs, %d client(s) done", took, len(ids))
            return EXIT_OK

    except AlreadyRunning:
        log.warning("another run is already going (%s); doing nothing", LOCK_PATH)
        return EXIT_ALREADY_RUNNING
    except Exception:
        log.exception("the nightly insights run could not start")
        return EXIT_FAILED


if __name__ == "__main__":
    sys.exit(main())