"""Shared test fixtures.

Tests run against a throwaway Postgres container, not Supabase. Tables are
created once per session and every test runs inside a transaction that gets
rolled back, so tests can't affect each other.
"""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.api.deps import get_db
from app.core.security import CurrentStaff, get_current_staff
from app.db.base import Base

# Import every model so Base.metadata knows about all the tables.
import app.models  # noqa: F401

# Aliased — `app` is already bound to the package by the import above, so
# `from app.main import app` would be shadowed by it.
from app.main import app as fastapi_app

from app.models.branch import Branch
from app.models.main_menu_category import MainCategory
from app.models.menu_item import MenuItem
from app.models.permission import Permission
from app.models.role import Role
from app.models.staff import Staff
from app.models.sub_menu_category import SubCategory
from app.models.table import Table
from app.models.tenant import Tenant

# Port 5433 deliberately — so a misconfigured test can never reach a real
# database on the default port.
TEST_DATABASE_URL = "postgresql+psycopg2://postgres:testpass@localhost:5433/sweet1ne_test"


@pytest.fixture(scope="session")
def engine():
    """One engine and one set of tables for the whole run.

    The schema is dropped wholesale rather than via drop_all, because roles
    and staff reference each other — SQLAlchemy can't order that, but
    Postgres handles the cycle fine with CASCADE.
    """
    engine = create_engine(TEST_DATABASE_URL)

    with engine.begin() as connection:
        connection.execute(text("DROP SCHEMA public CASCADE"))
        connection.execute(text("CREATE SCHEMA public"))

    Base.metadata.create_all(engine)

    yield engine

    with engine.begin() as connection:
        connection.execute(text("DROP SCHEMA public CASCADE"))
        connection.execute(text("CREATE SCHEMA public"))

    engine.dispose()


@pytest.fixture
def db(engine) -> Session:
    """A session wrapped in a transaction that's rolled back afterwards.

    This is what keeps tests independent — whatever a test writes is undone
    before the next one starts, so the order they run in never matters.
    """
    connection = engine.connect()
    transaction = connection.begin()
    session = sessionmaker(bind=connection)()

    yield session

    session.close()
    transaction.rollback()
    connection.close()


# --- Seed data ---------------------------------------------------------


@pytest.fixture
def tenant(db) -> Tenant:
    tenant = Tenant(
        name="Sweet1NE Test",
        slug="sweet1ne-test",
        currency="GBP",
        timezone="Europe/London",
    )
    db.add(tenant)
    db.flush()
    return tenant


@pytest.fixture
def branches(db, tenant) -> tuple[Branch, Branch]:
    """Two branches, so cross-branch access can actually be tested."""
    downtown = Branch(
        tenant_id=tenant.id, name="Downtown", slug="downtown", is_active=True
    )
    westlands = Branch(
        tenant_id=tenant.id, name="Westlands", slug="westlands", is_active=True
    )
    db.add_all([downtown, westlands])
    db.flush()
    return downtown, westlands


@pytest.fixture
def permissions(db) -> dict[str, Permission]:
    """The permission catalogue, keyed for easy lookup when building roles."""
    keys = [
        "manage_staff",
        "manage_roles",
        "manage_tables",
        "view_staff_pay",
        "view_orders",
        "view_all_orders",
        "place_orders",
        "edit_orders",
        "void_orders",
        "view_menu",
        "edit_menu",
        "access_kitchen",
        "access_bar",
        "access_reports",
        "update_order_status",
        "manage_tenant",
        "manage_settings",
        "manage_promotions",
    ]

    created = {}
    for key in keys:
        permission = Permission(
            key=key, display_name=key.replace("_", " ").title(), category="test"
        )
        db.add(permission)
        created[key] = permission

    db.flush()
    return created


def make_role(db, tenant, name, permission_keys, permissions, is_super_admin=False):
    role = Role(
        tenant_id=tenant.id,
        name=name,
        is_super_admin=is_super_admin,
        is_active=True,
        permissions=[permissions[k] for k in permission_keys],
    )
    db.add(role)
    db.flush()
    return role


def make_staff(db, tenant, role, branch, email):
    staff = Staff(
        id=uuid.uuid4(),
        tenant_id=tenant.id,
        branch_id=branch.id if branch else None,
        role_id=role.id,
        email=email,
        full_name=email.split("@")[0].title(),
        is_active=True,
    )
    db.add(staff)
    db.flush()
    return staff


@pytest.fixture
def director(db, tenant, permissions) -> Staff:
    """Unscoped and super-admin — bypasses every permission check, which is
    why the role deliberately has no permissions attached."""
    role = make_role(db, tenant, "Director", [], permissions, is_super_admin=True)
    return make_staff(db, tenant, role, None, "director@test.com")


@pytest.fixture
def manager(db, tenant, branches, permissions) -> Staff:
    """Scoped to Downtown, with staff and pay access."""
    downtown, _ = branches
    role = make_role(
        db,
        tenant,
        "Manager",
        [
            "manage_staff",
            "view_staff_pay",
            "view_orders",
            "view_all_orders",
            "manage_tables",
            "access_reports",
        ],
        permissions,
    )
    return make_staff(db, tenant, role, downtown, "manager@test.com")


@pytest.fixture
def supervisor(db, tenant, branches, permissions) -> Staff:
    """Manages staff at Downtown but can't see pay — exists to test that
    the two permissions genuinely come apart."""
    downtown, _ = branches
    role = make_role(db, tenant, "Supervisor", ["manage_staff"], permissions)
    return make_staff(db, tenant, role, downtown, "supervisor@test.com")


@pytest.fixture
def westlands_manager(db, tenant, branches, permissions) -> Staff:
    """A manager at the other branch — for testing cross-branch access."""
    _, westlands = branches
    role = make_role(
        db,
        tenant,
        "Westlands Manager",
        ["manage_staff", "view_orders", "manage_tables"],
        permissions,
    )
    return make_staff(db, tenant, role, westlands, "westlands@test.com")


@pytest.fixture
def waiter(db, tenant, branches, permissions) -> Staff:
    downtown, _ = branches
    role = make_role(
        db,
        tenant,
        "Waiter",
        ["view_menu", "place_orders", "view_orders"],
        permissions,
    )
    return make_staff(db, tenant, role, downtown, "waiter@test.com")


@pytest.fixture
def chef(db, tenant, branches, permissions) -> Staff:
    downtown, _ = branches
    role = make_role(
        db,
        tenant,
        "Chef",
        ["access_kitchen", "view_orders", "update_order_status"],
        permissions,
    )
    return make_staff(db, tenant, role, downtown, "chef@test.com")


@pytest.fixture
def bartender(db, tenant, branches, permissions) -> Staff:
    downtown, _ = branches
    role = make_role(
        db,
        tenant,
        "Bartender",
        ["access_bar", "view_orders", "update_order_status"],
        permissions,
    )
    return make_staff(db, tenant, role, downtown, "bartender@test.com")


# --- Menu and tables ---------------------------------------------------


@pytest.fixture
def menu(db, tenant, branches) -> dict:
    """A minimal menu split across both stations, so split-order behaviour
    can be exercised."""
    downtown, _ = branches

    food = MainCategory(
        tenant_id=tenant.id,
        branch_id=downtown.id,
        name="Mains",
        slug="mains",
        prep_station="kitchen",
        is_active=True,
    )
    drinks = MainCategory(
        tenant_id=tenant.id,
        branch_id=downtown.id,
        name="Drinks",
        slug="drinks",
        prep_station="bar",
        is_active=True,
    )
    db.add_all([food, drinks])
    db.flush()

    food_sub = SubCategory(
        main_category_id=food.id, name="Grill", slug="grill", is_active=True
    )
    drinks_sub = SubCategory(
        main_category_id=drinks.id, name="Beer", slug="beer", is_active=True
    )
    db.add_all([food_sub, drinks_sub])
    db.flush()

    steak = MenuItem(
        sub_category_id=food_sub.id,
        title="Steak",
        price=20.00,
        is_available=True,
        dietary_tags=[],
        allergen_tags=[],
    )
    pint = MenuItem(
        sub_category_id=drinks_sub.id,
        title="Pint",
        price=5.00,
        is_available=True,
        dietary_tags=[],
        allergen_tags=[],
    )
    db.add_all([steak, pint])
    db.flush()

    return {
        "food_category": food,
        "drinks_category": drinks,
        "steak": steak,
        "pint": pint,
    }


@pytest.fixture
def tables(db, branches) -> tuple[Table, Table]:
    """One table at each branch."""
    downtown, westlands = branches

    downtown_table = Table(
        branch_id=downtown.id,
        number=1,
        seats=4,
        region="Main floor",
        qr_token=uuid.uuid4(),
        is_active=True,
    )
    westlands_table = Table(
        branch_id=westlands.id,
        number=1,
        seats=2,
        qr_token=uuid.uuid4(),
        is_active=True,
    )
    db.add_all([downtown_table, westlands_table])
    db.flush()

    return downtown_table, westlands_table


# --- The client --------------------------------------------------------


@pytest.fixture
def client(db):
    """A test client with the database dependency swapped for our
    transaction-wrapped session."""

    def override_get_db():
        yield db

    fastapi_app.dependency_overrides[get_db] = override_get_db
    yield TestClient(fastapi_app)
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def as_staff(client, db):
    """Log in as a given staff member, without real tokens.

    Overriding get_current_staff means tests never touch Supabase Auth —
    they exercise the permission logic, which is what's actually under test.
    """

    def _login(staff: Staff):
        role = db.get(Role, staff.role_id)

        current = CurrentStaff(
            user_id=str(staff.id),
            tenant_id=str(staff.tenant_id),
            branch_id=str(staff.branch_id) if staff.branch_id else None,
            role_name=role.name,
            permissions={p.key for p in role.permissions},
            is_super_admin=role.is_super_admin,
        )

        fastapi_app.dependency_overrides[get_current_staff] = lambda: current
        return client

    yield _login
    fastapi_app.dependency_overrides.pop(get_current_staff, None)